import { useCallback, useEffect, useState } from 'react'
import { applyUiTheme, loadUiTheme, saveUiTheme, type UiTheme } from '../lib/uiThemeStorage'

export function useUiTheme() {
  const [theme, setThemeState] = useState<UiTheme>(() => loadUiTheme())

  useEffect(() => {
    applyUiTheme(theme)
    saveUiTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next)
  }, [])

  const togglePlainLight = useCallback(() => {
    setThemeState((t) => (t === 'plain-light' ? 'dark' : 'plain-light'))
  }, [])

  return { theme, setTheme, togglePlainLight, isPlainLight: theme === 'plain-light' }
}
