// Supabase Edge Function: create-staff
// Creates a login (auth user) + profile for a staff member. Only an OWNER may call it.
// The service-role key is provided by Supabase to the function as an environment variable;
// it is never in the app code and never sent to the browser.

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const ROLES = ['branch_manager', 'billing_staff', 'store_keeper', 'accountant']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceKey) return json({ error: 'SERVER_CONFIG' }, 500)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // 1. who is calling? (must be a signed-in, active owner)
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: caller, error: callerErr } = await admin.auth.getUser(token)
    if (callerErr || !caller.user) return json({ error: 'NOT_SIGNED_IN' }, 401)

    const { data: me } = await admin
      .from('profiles')
      .select('company_id, role, is_active')
      .eq('id', caller.user.id)
      .maybeSingle()
    if (!me || me.role !== 'owner' || !me.is_active) return json({ error: 'NOT_OWNER' }, 403)

    // 2. check the input
    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    const fullName = String(body?.full_name ?? '').trim()
    const role = String(body?.role ?? '')
    const branchId = String(body?.branch_id ?? '')
    const phone = String(body?.phone ?? '').trim()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName === '' || !ROLES.includes(role) || branchId === '') {
      return json({ error: 'INVALID_INPUT' }, 400)
    }
    if (password.length < 8) return json({ error: 'WEAK_PASSWORD' }, 400)

    // the branch must belong to the owner's company
    const { data: branch } = await admin
      .from('branches')
      .select('id')
      .eq('id', branchId)
      .eq('company_id', me.company_id)
      .maybeSingle()
    if (!branch) return json({ error: 'BRANCH_NOT_FOUND' }, 400)

    // 3. create the login, then the profile (undo the login if the profile fails)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr || !created.user) {
      const msg = createErr?.message ?? ''
      return json({ error: /already|registered|exists/i.test(msg) ? 'EMAIL_EXISTS' : 'AUTH_FAILED', detail: msg }, 400)
    }

    const { error: profileErr } = await admin.from('profiles').insert({
      id: created.user.id,
      company_id: me.company_id,
      branch_id: branchId,
      role,
      full_name: fullName,
      phone: phone === '' ? null : phone,
    })
    if (profileErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: 'PROFILE_FAILED', detail: profileErr.message }, 400)
    }

    return json({ ok: true, user_id: created.user.id })
  } catch (e) {
    return json({ error: 'SERVER', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
