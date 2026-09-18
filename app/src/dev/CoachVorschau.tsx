import { CoachAuswertungTafel } from '../cockpit/components/sales/CoachAuswertungTafel'
import type { CoachEingabe, CoachTageszeile } from '../cockpit/lib/coachAuswertung'

/**
 * Dev-Vorschau (nur DEV, ohne Login): die Coach-Auswertung mit erfundenen
 * Wochenzahlen. Gleiches Muster wie `RechnungVorschau`. Die Rechnung selbst
 * prüft `scripts/verify-coach-auswertung.ts`.
 */

const leer: Omit<CoachTageszeile, 'datum'> = {
  li_anfragen: 0, li_nachrichten: 0, inmails: 0, looms: 0, li_followups: 0, ig_followups: 0, call_followups: 0,
  antworten_li: 0, termine_li: 0, termine_ig: 0, termine_call: 0, quali_termine: 0, sales_calls: 0, abschluesse: 0, umsatz: 0,
}

const jetzt = new Date()
const tagIso = (vorTagen: number) => {
  const d = new Date(jetzt)
  d.setDate(d.getDate() - vorTagen)
  return d.toISOString().slice(0, 10)
}

const EINGABE: CoachEingabe = {
  tageszeilen: Array.from({ length: 28 }, (_, i) => ({
    ...leer,
    datum: tagIso(i),
    li_anfragen: i % 7 < 5 ? 35 : 0,
    li_nachrichten: i % 7 < 5 ? 8 : 0,
    looms: i % 3 === 0 ? 1 : 0,
    li_followups: i % 2,
    antworten_li: i % 4 === 0 ? 2 : 0,
    termine_li: i % 9 === 0 ? 1 : 0,
    quali_termine: i % 9 === 0 ? 1 : 0,
    abschluesse: i === 3 ? 1 : 0,
    umsatz: i === 3 ? 5000 : 0,
  })),
  erstnachrichten: [],
  netzwerk: Array.from({ length: 60 }, (_, i) => ({ status: 'angenommen', eingeladen_at: null, angenommen_at: `${tagIso(i % 28)}T10:00:00Z` })),
  ereignisse: [],
  jetzt,
}

export function CoachVorschau() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24 }}>
      <div className="ck-panel" style={{ width: 'min(720px, 94vw)', padding: 20, margin: '0 auto' }}>
        <CoachAuswertungTafel eingabe={EINGABE} />
      </div>
    </div>
  )
}
