export type UiTheme = 'dark' | 'plain-light'

const KEY = 'brand-os-ui-theme'

export const UI_THEME_EVENT = 'brand-os-ui-theme'

const THEME_COLOR: Record<UiTheme, string> = {
  dark: '#0b0f12',
  'plain-light': '#f7f7f9',
}

export function loadUiTheme(): UiTheme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'plain-light' ? 'plain-light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function saveUiTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyUiTheme(theme: UiTheme): void {
  const root = document.documentElement
  if (theme === 'plain-light') {
    root.setAttribute('data-ui-theme', 'plain-light')
  } else {
    root.removeAttribute('data-ui-theme')
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLOR[theme]
  window.dispatchEvent(new CustomEvent<UiTheme>(UI_THEME_EVENT, { detail: theme }))
}
