import { Outlet } from 'react-router-dom'
import { ChatBubble } from './components/ChatBubble'
import { NavRail } from './components/NavRail'
import { RunWatcher } from './components/RunWatcher'
import { StatusBar } from './components/StatusBar'
import { UrielAura } from './components/UrielAura'
import { UrielDock } from './components/UrielDock'
import { ActiveBrandProvider } from './lib/activeBrand'
import '../styles/cockpit.css'

/**
 * Neue App-Shell (REBUILD-PLAN §5): Statusleiste oben, Nav-Rail links,
 * Inhalt rechts. Volle Viewport-Höhe, eigenes Scroll-Management im Content.
 * Kein Canvas, kein Glas — bewusst schlichtes DOM-Layout.
 */
export function CockpitShell() {
  return (
    <ActiveBrandProvider>
      <div
        className="ck-root"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          zIndex: 2,
        }}
      >
        <UrielAura />
        <StatusBar />
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <NavRail />
          <main className="ck-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            <Outlet />
          </main>
        </div>
        <ChatBubble />
        <UrielDock />
        <RunWatcher />
      </div>
    </ActiveBrandProvider>
  )
}
