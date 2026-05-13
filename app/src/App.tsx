import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Background } from './components/Background'
import { CommandPalette } from './components/CommandPalette'
import { RequireAuthShell } from './components/RequireAuthShell'
import { RequireOwnerGate } from './components/RequireOwnerGate'
import { SaveStatusIndicator } from './components/SaveStatusIndicator'
import { ShortcutsOverlay } from './components/ShortcutsOverlay'
import { ToastProvider } from './components/Toast'
import { CommandPaletteContext } from './lib/commandPaletteContext'
import { SaveStatusProvider } from './lib/saveStatusContext'
import { BrandPage } from './pages/BrandPage'
import { DeliverMode } from './pages/DeliverMode'
import { ProjectPage } from './pages/deliver/ProjectPage'
import { IntelligenceMode } from './pages/intelligence/IntelligenceMode'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PortalRoute } from './pages/portal/PortalRoute'
import { BookingPublicPage } from './pages/public/BookingPublicPage'
import { LeadIntakePage } from './pages/public/LeadIntakePage'
import { PromoMode } from './pages/promo/PromoMode'
import { useViewport } from './hooks/useViewport'
import { CallModePage } from './pages/sales/CallModePage'
import { ContactListsPage } from './pages/sales/ContactListsPage'
import { ContactPage } from './pages/sales/ContactPage'
import { OnboardingPublicPage } from './pages/onboarding/OnboardingPublicPage'
import { SalesMode } from './pages/sales/SalesMode'
import { UniversePage } from './pages/UniversePage'
import { useWorldCameraSyncFromRoute } from './store/worldCamera'
import { World } from './three/World'
import { FoundationMode } from './modes/FoundationMode'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

function OwnerWorkspaceShell() {
  useWorldCameraSyncFromRoute()
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const slugMatch = location.pathname.match(/^\/brand\/([^/]+)/)
  const slugRef = useRef<string | undefined>(slugMatch?.[1])
  slugRef.current = slugMatch?.[1]

  const gPrefixRef = useRef<{ active: boolean; timeout: number | null }>({
    active: false,
    timeout: null,
  })

  useEffect(() => {
    const clearGPrefix = () => {
      if (gPrefixRef.current.timeout) {
        window.clearTimeout(gPrefixRef.current.timeout)
        gPrefixRef.current.timeout = null
      }
      gPrefixRef.current.active = false
    }

    const handler = (e: KeyboardEvent) => {
      const isCmdK =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.shiftKey && !e.altKey
      if (isCmdK) {
        e.preventDefault()
        setCmdkOpen((o) => !o)
        return
      }

      if (isEditableTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
        return
      }

      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false)
        return
      }

      const key = e.key.toLowerCase()

      if (gPrefixRef.current.active) {
        const slug = slugRef.current
        const map: Record<string, string> = {
          d: 'dashboard',
          b: 'foundation',
          f: 'foundation',
          s: 'sales',
          i: 'intelligence',
          p: 'deliver',
        }
        const target = map[key]
        if (slug && target) {
          e.preventDefault()
          navigate(`/brand/${slug}/${target}`)
        } else if (key === 'h') {
          e.preventDefault()
          navigate('/')
        }
        clearGPrefix()
        return
      }

      if (key === 'g') {
        gPrefixRef.current.active = true
        gPrefixRef.current.timeout = window.setTimeout(clearGPrefix, 1200)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      clearGPrefix()
    }
  }, [navigate, shortcutsOpen])

  return (
    <RequireAuthShell>
      <RequireOwnerGate>
        <CommandPaletteContext.Provider
          value={{
            open: cmdkOpen,
            openPalette: () => setCmdkOpen(true),
            closePalette: () => setCmdkOpen(false),
          }}
        >
          <Outlet />
          <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
          <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </CommandPaletteContext.Provider>
      </RequireOwnerGate>
    </RequireAuthShell>
  )
}

function App() {
  const location = useLocation()
  const { isMobile } = useViewport()
  const isHome = location.pathname === '/'
  const isBrandWorkspace = location.pathname.startsWith('/brand/')
  const canvasPointerEvents = isHome || isBrandWorkspace ? 'auto' : 'none'
  const mobileWorldDisabled = isMobile && (isHome || isBrandWorkspace)
  const hideCanvas =
    location.pathname.startsWith('/portal') ||
    location.pathname.startsWith('/onboarding') ||
    mobileWorldDisabled

  return (
    <ToastProvider>
      <SaveStatusProvider>
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
          <World />
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
            <Route path="/book/:brandSlug/:linkSlug" element={<BookingPublicPage />} />
            <Route path="/leads/:brandSlug" element={<LeadIntakePage />} />
            <Route element={<OwnerWorkspaceShell />}>
              <Route path="/" element={<UniversePage />} />
              <Route path="/brand/:slug" element={<BrandPage />}>
                <Route path="dashboard" element={<Navigate to=".." replace />} />
                <Route path="foundation" element={<FoundationMode />} />
                <Route path="building" element={<Navigate to="../foundation" replace />} />
                <Route path="discovery" element={<Navigate to="../foundation" replace />} />
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
      <SaveStatusIndicator />
      </SaveStatusProvider>
    </ToastProvider>
  )
}

export default App
