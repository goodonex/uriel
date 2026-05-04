import { Route, Routes } from 'react-router-dom'
import { Background } from './components/Background'
import { ModeNav } from './components/ModeNav'
import { ToastProvider } from './components/Toast'
import { BrandPage } from './pages/BrandPage'
import { BuildingMode } from './pages/building/BuildingMode'
import { DiscoveryMode } from './pages/discovery/DiscoveryMode'
import { ModePlaceholder } from './pages/ModePlaceholder'
import { NodeGraphPage } from './pages/NodeGraphPage'

function App() {
  return (
    <ToastProvider>
      <Background />
      <main
        className="relative mx-auto"
        style={{
          zIndex: 1,
          maxWidth: 1100,
          padding: '24px 32px 48px',
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
    </ToastProvider>
  )
}

export default App
