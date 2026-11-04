import { PhotoPicker } from '../prescriptions/PhotoPicker'
import type { DoctorOption } from '../register/api'
import type { DoctorMode, RxDraft } from './rx'
import { Tabs, type TabItem } from '../../components/ui'

interface Props {
  doctors: DoctorOption[]
  value: RxDraft
  onChange: (v: RxDraft) => void
  strict: boolean // Schedule H1 / X in the cart
  files: File[]
  onFiles: (f: File[]) => void
  disabled: boolean
}

export function RxPanel({ doctors, value, onChange, strict, files, onFiles, disabled }: Props) {
  const modes: { v: DoctorMode; label: string }[] = [
    { v: 'existing', label: 'હાલના doctor' },
    { v: 'new', label: 'નવા doctor' },
  ]
  const set = (p: Partial<RxDraft>) => onChange({ ...value, ...p })

  return (
    <section className="rounded-xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-900 dark:bg-slate-900" aria-label="Prescription">
      <h2 className="font-semibold">Prescription વિગતો</h2>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        Cart માં Schedule {strict ? 'H1/X' : 'H'} દવા છે. Doctor અને patient ની વિગતો Schedule register માં નોંધાશે અને પછી બદલી શકાશે નહીં.
      </p>

      <Tabs<DoctorMode>
        className="mt-3"
        label="Doctor"
        value={value.doctorMode}
        onChange={(m) => set({ doctorMode: m })}
        disabled={disabled}
        items={modes.map((m): TabItem<DoctorMode> => ({ value: m.v, label: m.label, icon: m.v === 'existing' ? 'stethoscope' : 'plus' }))}
      />

      {value.doctorMode === 'existing' ? (
        <div className="mt-3">
          <label htmlFor="rx-doc" className="mb-1 block text-sm font-medium">Doctor</label>
          <select id="rx-doc" className="field" value={value.doctorId} disabled={disabled} onChange={(e) => set({ doctorId: e.target.value })}>
            <option value="">— પસંદ કરો —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.regNo ? ` · ${d.regNo}` : ''}
              </option>
            ))}
          </select>
          {doctors.length === 0 && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">હજી કોઈ doctor નથી. "નવા doctor" પસંદ કરો.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="rx-dname" className="mb-1 block text-sm font-medium">Doctor નું નામ *</label>
            <input id="rx-dname" className="field" value={value.doctorName} disabled={disabled} onChange={(e) => set({ doctorName: e.target.value })} />
          </div>
          <div className="min-w-0">
            <label htmlFor="rx-dreg" className="mb-1 block text-sm font-medium">Registration no {strict ? '*' : ''}</label>
            <input id="rx-dreg" className="field" value={value.doctorRegNo} disabled={disabled} onChange={(e) => set({ doctorRegNo: e.target.value })} />
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="rx-pname" className="mb-1 block text-sm font-medium">Patient નું નામ *</label>
          <input id="rx-pname" className="field" value={value.patientName} disabled={disabled} onChange={(e) => set({ patientName: e.target.value })} />
        </div>
        <div className="min-w-0">
          <label htmlFor="rx-page" className="mb-1 block text-sm font-medium">ઉંમર</label>
          <input id="rx-page" className="field" value={value.patientAge} disabled={disabled} onChange={(e) => set({ patientAge: e.target.value })} />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="rx-paddr" className="mb-1 block text-sm font-medium">Patient નું સરનામું {strict ? '*' : ''}</label>
          <input id="rx-paddr" className="field" value={value.patientAddress} disabled={disabled} onChange={(e) => set({ patientAddress: e.target.value })} />
        </div>
      </div>

      <PhotoPicker files={files} onChange={onFiles} disabled={disabled} />
    </section>
  )
}
