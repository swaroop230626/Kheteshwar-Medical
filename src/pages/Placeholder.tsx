export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">આ પેજ હજી બન્યું નથી.</p>
    </div>
  )
}
