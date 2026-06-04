export type UiTheme = 'dark' | 'plain-light'

const KEY = 'brand-os-ui-theme'

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
}
