import { useTheme } from '../theme/ThemeContext'
import { Icon } from './Icon'

// Light / Dark switch (top right)
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      aria-label="Dark mode"
      title={dark ? 'Light style પર જાઓ' : 'Dark style પર જાઓ'}
      className="btn-ghost min-w-11 shrink-0 px-0 print:hidden"
    >
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  )
}
