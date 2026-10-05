import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { applyUiTheme, loadUiTheme } from './lib/uiThemeStorage'
import './index.css'

applyUiTheme(loadUiTheme())

/**
 * Service Worker registrieren (O3, Zug 1) — Voraussetzung für Web Push.
 *
 * Fehlertolerant: ohne Secure Context, im Privatfenster oder bei abgeschalteten
 * Workern schlägt das fehl. Das darf die App nicht aufhalten — Push ist ein
 * Zusatz, kein Fundament. Registrierung nach `load`, damit der Worker nicht mit
 * dem ersten Rendern um Bandbreite konkurriert.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('[push] Service Worker nicht registriert:', e?.message ?? e)
    })
  })
}

/**
 * Fremde Seiten nie im Uriel-Tab (Kevin, 05.10.2026: „alle Buttons in einem
 * neuen Tab, nie im jetzigen, dass dann Uriel zu ist"). Die Links tragen
 * `target="_blank"` schon einzeln — das hier fängt jeden ab, der es vergisst.
 * Eigene Routen, `tel:`, `mailto:` und App-Links (`claude://`) bleiben unberührt.
 */
document.addEventListener(
  'click',
  (e) => {
    if (e.defaultPrevented || e.button !== 0) return
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a || !/^https?:$/.test(a.protocol) || a.origin === window.location.origin) return
    if (a.target === '_blank') return
    e.preventDefault()
    window.open(a.href, '_blank', 'noopener')
  },
  true,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Welcher Stand läuft hier? `scripts/live-check.ts` sucht diesen Commit im Bundle (02.10.2026).
declare const __BUILD_COMMIT__: string
;(window as unknown as { __URIEL_COMMIT__: string }).__URIEL_COMMIT__ = __BUILD_COMMIT__
