import { useCallback, useEffect, useState } from 'react'
import {
  applyUiTheme,
  loadUiTheme,
  saveUiTheme,
  UI_THEME_EVENT,
  type UiTheme,
} from '../lib/uiThemeStorage'

export function useUiTheme() {
  const [theme, setThemeState] = useState<UiTheme>(() => loadUiTheme())

  useEffect(() => {
    applyUiTheme(theme)
    saveUiTheme(theme)
  }, [theme])

  // Alle Hook-Instanzen (Sidebar, StatusBar, CommandPalette, …) synchron halten.
  useEffect(() => {
    const onThemeEvent = (e: Event) => {
      const next = (e as CustomEvent<UiTheme>).detail
      setThemeState((t) => (t === next ? t : next))
    }
    window.addEventListener(UI_THEME_EVENT, onThemeEvent)
    return () => window.removeEventListener(UI_THEME_EVENT, onThemeEvent)
  }, [])

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next)
  }, [])

  const togglePlainLight = useCallback(() => {
    setThemeState((t) => (t === 'plain-light' ? 'dark' : 'plain-light'))
  }, [])

  return { theme, setTheme, togglePlainLight, isPlainLight: theme === 'plain-light' }
}
