import { Html } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Background } from './components/Background'
import { ModeNav } from './components/ModeNav'
import { ToastProvider } from './components/Toast'
import { BrandPage } from './pages/BrandPage'
import { BuildingMode } from './pages/building/BuildingMode'
import { DiscoveryMode } from './pages/discovery/DiscoveryMode'
import { ModePlaceholder } from './pages/ModePlaceholder'
import { NodeGraphPage } from './pages/NodeGraphPage'
import { NodeGraph } from './three/NodeGraph'

function App() {
  return (
    <ToastProvider>
      <Background />
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
        }}
      >
        <Suspense fallback={null}>
          <NodeGraph />
        </Suspense>
        <Html
          fullscreen
          style={{
            /* Nicht width/height 100% setzen — überschreibt dreis Fullscreen-Maße und kollabiert ohne Parent-Höhe. */
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <main
            className="relative mx-auto"
            style={{
              pointerEvents: 'none',
              background: 'transparent',
              maxWidth: 1100,
              padding: '24px 32px 48px',
              minHeight: '100%',
              maxHeight: '100vh',
              overflowY: 'auto',
              zIndex: 1,
            }}
          >
            <Routes>
              <Route path="/" element={<NodeGraphPage />} />
              <Route path="/brand/:slug" element={<BrandPage />}>
                <Route index element={<ModeNav />} />
                <Route path="building" element={<BuildingMode />} />
                <Route path="discovery" element={<DiscoveryMode />} />
                <Route
                  path="promo"
                  element={
                    <ModePlaceholder
                      mode="promo"
                      title="Promo Mode"
                      phase="Phase 3"
                      description="Content-Pieces, Kampagnen, Auto-Tagging und Performance-Tracking. Verbunden mit Foundation und Sales."
                    />
                  }
                />
                <Route
                  path="sales"
                  element={
                    <ModePlaceholder
                      mode="sales"
                      title="Sales Mode"
                      phase="Phase 4"
                      description="Leichtes CRM. Pipeline, Kontakte, Follow-ups — verbunden mit Promo. Quelle jedes Kontakts wird auf Content zurückverfolgt."
                    />
                  }
                />
                <Route
                  path="intelligence"
                  element={
                    <ModePlaceholder
                      mode="intelligence"
                      title="Intelligence Mode"
                      phase="Phase 5"
                      description="Lernschicht. Pattern Recognition, ICP-Drift, Foundation-Optimierung. Läuft im Hintergrund und füttert den Focus."
                    />
                  }
                />
              </Route>
            </Routes>
          </main>
        </Html>
      </Canvas>
    </ToastProvider>
  )
}

export default App
