import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { Background } from './components/Background'
import { ModeNav } from './components/ModeNav'
import { RequireAuthShell } from './components/RequireAuthShell'
import { RequireClientGate } from './components/RequireClientGate'
import { RequireOwnerGate } from './components/RequireOwnerGate'
import { ToastProvider } from './components/Toast'
import { BrandPage } from './pages/BrandPage'
import { BuildingMode } from './pages/building/BuildingMode'
import { DiscoveryMode } from './pages/discovery/DiscoveryMode'
import { IntelligenceMode } from './pages/intelligence/IntelligenceMode'
import { LoginPage } from './pages/LoginPage'
import { ClientPortal } from './pages/portal/ClientPortal'
import { PromoMode } from './pages/promo/PromoMode'
import { SalesMode } from './pages/sales/SalesMode'
import { NodeGraphPage } from './pages/NodeGraphPage'
import { NodeGraph } from './three/NodeGraph'

function OwnerWorkspaceShell() {
  return (
    <RequireAuthShell>
      <RequireOwnerGate>
        <Outlet />
      </RequireOwnerGate>
    </RequireAuthShell>
  )
}

function App() {
  return (
    <ToastProvider>
      <Background />
      {/* Persistenter 3D-Hintergrund — Router als fixes DOM-Overlay (zuverlässiger als drei Html fullscreen). */}
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 11], fov: 35 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          display: 'block',
          outline: 'none',
        }}
      >
        <Suspense fallback={null}>
          <NodeGraph />
        </Suspense>
      </Canvas>

      <div
        id="app-ui-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          overflow: 'hidden',
          outline: 'none',
          border: 'none',
        }}
      >
        <main
          className="relative mx-auto"
          style={{
            pointerEvents: 'none',
            background: 'transparent',
            maxWidth: 1100,
            margin: '0 auto',
            padding: '24px 32px 48px',
            minHeight: '100vh',
            maxHeight: '100vh',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            outline: 'none',
            border: 'none',
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/portal/:clientSlug"
              element={
                <RequireAuthShell>
                  <RequireClientGate>
                    <ClientPortal />
                  </RequireClientGate>
                </RequireAuthShell>
              }
            />
            <Route element={<OwnerWorkspaceShell />}>
              <Route path="/" element={<NodeGraphPage />} />
              <Route path="/brand/:slug" element={<BrandPage />}>
                <Route index element={<ModeNav />} />
                <Route path="building" element={<BuildingMode />} />
                <Route path="discovery" element={<DiscoveryMode />} />
                <Route path="promo" element={<PromoMode />} />
                <Route path="sales" element={<SalesMode />} />
                <Route path="intelligence" element={<IntelligenceMode />} />
              </Route>
            </Route>
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}

export default App
