import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Background } from './components/Background'
import { RequireAuthShell } from './components/RequireAuthShell'
import { RequireOwnerGate } from './components/RequireOwnerGate'
import { ToastProvider } from './components/Toast'
import { BrandDashboardPage } from './pages/BrandDashboardPage'
import { BrandPage } from './pages/BrandPage'
import { BuildingMode } from './pages/building/BuildingMode'
import { DeliverMode } from './pages/DeliverMode'
import { ProjectPage } from './pages/deliver/ProjectPage'
import { DiscoveryMode } from './pages/discovery/DiscoveryMode'
import { IntelligenceMode } from './pages/intelligence/IntelligenceMode'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PortalRoute } from './pages/portal/PortalRoute'
import { PromoMode } from './pages/promo/PromoMode'
import { CallModePage } from './pages/sales/CallModePage'
import { ContactListsPage } from './pages/sales/ContactListsPage'
import { ContactPage } from './pages/sales/ContactPage'
import { OnboardingPublicPage } from './pages/onboarding/OnboardingPublicPage'
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
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isBrandWorkspace = location.pathname.startsWith('/brand/')
  const canvasPointerEvents = isHome ? 'auto' : 'none'
  const hideCanvas =
    location.pathname.startsWith('/portal') || location.pathname.startsWith('/onboarding')

  return (
    <ToastProvider>
      <Background />
      {/* Persistenter 3D-Hintergrund — Router als fixes DOM-Overlay (zuverlässiger als drei Html fullscreen). */}
      {!hideCanvas ? (
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
          pointerEvents: canvasPointerEvents,
        }}
      >
        <Suspense fallback={null}>
          <NodeGraph />
        </Suspense>
      </Canvas>
      ) : null}

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
          className={
            isHome || isBrandWorkspace
              ? 'relative mx-0 px-0 pb-0 pt-0'
              : 'relative mx-auto px-4 pb-10 pt-6 md:px-8 md:pb-12 md:pt-6'
          }
          style={{
            pointerEvents: 'none',
            background: 'transparent',
            maxWidth: isHome || isBrandWorkspace ? 'none' : 1100,
            margin: isHome || isBrandWorkspace ? 0 : '0 auto',
            minHeight: '100vh',
            maxHeight: '100vh',
            overflowY: isHome ? 'hidden' : 'auto',
            WebkitOverflowScrolling: 'touch',
            outline: 'none',
            border: 'none',
          }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/onboarding/:brandId" element={<OnboardingPublicPage />} />
            <Route path="/portal/:projectId" element={<PortalRoute />} />
            <Route element={<OwnerWorkspaceShell />}>
              <Route path="/" element={<NodeGraphPage />} />
              <Route path="/brand/:slug" element={<BrandPage />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<BrandDashboardPage />} />
                <Route path="building" element={<BuildingMode />} />
                <Route path="discovery" element={<DiscoveryMode />} />
                <Route path="promo" element={<PromoMode />} />
                <Route path="sales/lists" element={<ContactListsPage />} />
                <Route path="sales/lists/:listId" element={<ContactListsPage />} />
                <Route path="sales/call-mode" element={<CallModePage />} />
                <Route path="sales/:contactId" element={<ContactPage />} />
                <Route path="sales" element={<SalesMode />} />
                <Route path="intelligence" element={<IntelligenceMode />} />
                <Route path="deliver" element={<DeliverMode />} />
                <Route path="deliver/:projectId" element={<ProjectPage />} />
              </Route>
            </Route>
          </Routes>
        </main>
      </div>
    </ToastProvider>
  )
}

export default App
