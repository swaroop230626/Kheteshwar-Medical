// One icon set for the whole app (24px line icons), so every screen looks the same.
export const ICONS = {
  grid: 'M3 3h7v9H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 16h7v5H3z',
  receipt: 'M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z M8 7h8 M8 11h8 M8 15h5',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7l-10 10z M8.5 8.5l7 7',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  wallet: 'M3 7a2 2 0 0 1 2-2h14v4 M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H5a2 2 0 0 1-2-2z M16 14h2',
  chart: 'M3 3v18h18 M7 14v4 M12 9v9 M17 5v13',
  clipboard: 'M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 13l2 2 4-4',
  settings: 'M21 4h-7 M10 4H3 M21 12h-9 M8 12H3 M21 20h-5 M12 20H3 M14 2v4 M8 10v4 M16 18v4',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8z M3 8l9 5 9-5 M12 13v8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  trend: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  store: 'M3 9l1-5h16l1 5 M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 M5 12v8h14v-8 M10 20v-5h4v5',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  plus: 'M12 5v14 M5 12h14',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M18 6 6 18 M6 6l12 12',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  return: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  printer: 'M6 9V3h12v6 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v7H6z',
  message: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 1 1 21 11.5z',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}
