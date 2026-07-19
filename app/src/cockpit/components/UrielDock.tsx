import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useContacts } from '../../hooks/useContacts'
import { useUrielBus } from '../../store/urielBus'
import { useActiveBrand } from '../lib/activeBrand'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import {
  anfragenSum,
  nachrichtenSum,
  sumField,
  termineVereinbartTotal,
  weekVitals,
} from '../lib/metricsAggregate'
import { MONTH_TARGETS, currentSoll, formatEuro } from '../lib/goals'
import { useUrielVoice } from '../lib/useUrielVoice'
import { runUrielTurn, type ToolResult, type UrielAction, type UrielMessage } from '../lib/urielAgent'
import type { ViewMode } from '../graph/nebulaLayout'

const AREA_PATH: Record<string, string> = {
  cockpit: '/cockpit',
  crm: '/crm',
  projekte: '/projekte',
  ads: '/ads',
  content: '/content',
  agenten: '/agenten',
  email: '/email',
  tracking: '/tracking',
}
const VIEW_LABEL: Record<ViewMode, string> = { rings: 'Ringe', nebula: 'Nebula', leads: 'Leads' }

interface DisplayTurn {
  role: 'user' | 'uriel'
  text: string
  actions?: UrielAction[]
}

/**
 * UrielDock — die Oberfläche, über die Kevin mit Uriel spricht (Text + Stimme).
 * Führt die Agenten-Schleife (urielAgent) aus und stellt die Werkzeuge bereit:
 * UI-Steuerung (Graph/Navigation/Brand) + Datenlesen (KPIs/CRM) aus dem bereits
 * geladenen, eingeloggten Cockpit-State. Konversation ist bewusst flüchtig (v1).
 */
export function UrielDock() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<DisplayTurn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speakReplies, setSpeakReplies] = useState(false)
  const historyRef = useRef<UrielMessage[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const { activeBrand, activeSlug, brands, setActiveSlug } = useActiveBrand()
  const metrics = useDailyMetrics()
  const contacts = useContacts(activeSlug)
  const requestGraph = useUrielBus((s) => s.requestGraph)
  const voice = useUrielVoice()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [turns, busy])

  const ensureCockpit = useCallback(() => {
    if (location.pathname !== '/cockpit') navigate('/cockpit')
  }, [location.pathname, navigate])

  /** Werkzeug-Ausführung — frisch pro Zug, sieht damit aktuelle Daten. */
  const execute = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<ToolResult> => {
      switch (name) {
        case 'set_graph_view': {
          const view = input.view as ViewMode
          ensureCockpit()
          requestGraph({ view })
          return { ok: true, summary: `Ansicht → ${VIEW_LABEL[view] ?? view}`, data: { done: true } }
        }
        case 'search_graph': {
          const query = String(input.query ?? '')
          ensureCockpit()
          requestGraph({ query })
          return { ok: true, summary: query ? `Graph-Suche „${query}"` : 'Graph-Suche zurückgesetzt', data: { done: true } }
        }
        case 'navigate': {
          const area = String(input.area ?? '')
          const path = AREA_PATH[area]
          if (!path) return { ok: false, summary: `Unbekannter Bereich: ${area}`, data: { error: 'unknown_area' } }
          navigate(path)
          return { ok: true, summary: `Navigiert → ${area}`, data: { done: true } }
        }
        case 'set_active_brand': {
          const slug = String(input.slug ?? '')
          const brand = brands.find((b) => b.slug === slug)
          if (!brand) {
            return {
              ok: false,
              summary: `Brand „${slug}" nicht gefunden`,
              data: { available: brands.map((b) => b.slug) },
            }
          }
          setActiveSlug(slug)
          return { ok: true, summary: `Brand → ${brand.name}`, data: { done: true } }
        }
        case 'open_contact': {
          const id = String(input.contact_id ?? '')
          if (!id) return { ok: false, summary: 'Keine contact_id', data: { error: 'missing_id' } }
          navigate(`/crm/${id}`)
          return { ok: true, summary: 'Kontakt geöffnet', data: { done: true } }
        }
        case 'get_today_kpis': {
          const t = metrics.today
          const data = {
            datum: t.datum,
            brand: activeBrand?.name ?? activeSlug,
            anfragen: anfragenSum(t),
            nachrichten: nachrichtenSum(t),
            looms: t.looms,
            termine_vereinbart: termineVereinbartTotal(t),
            abschluesse: t.abschluesse,
            umsatz: t.umsatz,
          }
          return { ok: true, summary: 'Heutige KPIs gelesen', data }
        }
        case 'get_week_vitals': {
          const vitals = weekVitals(metrics.weekRows, metrics.monthRows).map((v) => ({
            kategorie: v.label,
            aktuell: v.current,
            ziel: v.target,
          }))
          return { ok: true, summary: 'Wochen-Vitals gelesen', data: { brand: activeBrand?.name ?? activeSlug, vitals } }
        }
        case 'get_month_revenue': {
          const monthKey = new Date().toISOString().slice(0, 7)
          const target = MONTH_TARGETS[monthKey]
          const monthRevenue = sumField(metrics.monthRows, 'umsatz')
          const data = {
            brand: activeBrand?.name ?? activeSlug,
            monat: target?.label ?? monthKey,
            umsatz: monthRevenue,
            monatsziel: target?.total ?? null,
            soll_bis_heute: target ? currentSoll(target.curve) : null,
            umsatz_formatiert: formatEuro(monthRevenue),
          }
          return { ok: true, summary: 'Monatsumsatz gelesen', data }
        }
        case 'search_contacts': {
          const q = String(input.query ?? '').toLowerCase().trim()
          if (!q) return { ok: false, summary: 'Leere Suche', data: { error: 'empty_query' } }
          const hits = contacts.items
            .filter((c) => {
              const hay = [c.name, c.company, c.first_name, c.last_name]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
              return hay.includes(q)
            })
            .slice(0, 6)
            .map((c) => ({
              id: c.id,
              name: c.name,
              firma: c.company ?? null,
              stage: c.pipeline_stage,
              potenzial: c.potenzial_betrag ?? null,
            }))
          return {
            ok: true,
            summary: `${hits.length} Kontakt(e) für „${q}"`,
            data: { treffer: hits },
          }
        }
        default:
          return { ok: false, summary: `Unbekanntes Werkzeug: ${name}`, data: { error: 'unknown_tool' } }
      }
    },
    [ensureCockpit, requestGraph, navigate, brands, setActiveSlug, metrics, contacts, activeBrand, activeSlug],
  )

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim()
      if (!msg || busy) return
      setDraft('')
      setError(null)
      setBusy(true)
      setTurns((t) => [...t, { role: 'user', text: msg }])
      try {
        const result = await runUrielTurn(historyRef.current, msg, execute, {
          brandName: activeBrand?.name,
          brandSlug: activeSlug,
          date: new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
          area: location.pathname.replace('/', '') || 'cockpit',
        })
        historyRef.current = result.messages
        const finalText = result.finalText || '(keine Antwort)'
        setTurns((t) => [...t, { role: 'uriel', text: finalText, actions: result.actions }])
        if (speakReplies) voice.speak(finalText)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [busy, execute, activeBrand, activeSlug, location.pathname, speakReplies, voice],
  )

  const onMic = useCallback(() => {
    if (voice.listening) {
      voice.stopListening()
      return
    }
    voice.startListening((text) => {
      setDraft(text)
      void send(text)
    })
  }, [voice, send])

  return (
    <>
      {open ? (
        <div
          className="ck-root ck-uriel-panel"
          role="dialog"
          aria-label="Uriel"
          style={{
            width: 'min(440px, calc(100vw - 40px))',
            height: 'min(560px, calc(100vh - 120px))',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--ck-panel)',
            border: '1px solid var(--ck-border-strong)',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Kopf */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--ck-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--ck-accent)', fontSize: 15 }}>✦</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em' }}>URIEL</div>
                <div className="ck-label">{activeBrand?.name ?? activeSlug}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {voice.ttsSupported ? (
                <button
                  className="ck-btn"
                  style={{ padding: '3px 8px', color: speakReplies ? 'var(--ck-accent)' : undefined }}
                  onClick={() => { setSpeakReplies((v) => !v); voice.cancelSpeak() }}
                  aria-label={speakReplies ? 'Vorlesen aus' : 'Antworten vorlesen'}
                  title={speakReplies ? 'Vorlesen aus' : 'Antworten vorlesen'}
                >
                  {speakReplies ? '🔊' : '🔇'}
                </button>
              ) : null}
              <button className="ck-btn" style={{ padding: '3px 8px' }} onClick={() => setOpen(false)} aria-label="Uriel schließen">✕</button>
            </div>
          </div>

          {/* Verlauf */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {turns.length === 0 && !busy ? (
              <div style={{ fontSize: 12.5, color: 'var(--ck-text-3)', lineHeight: 1.7 }}>
                <p style={{ marginBottom: 8 }}>Sprich oder schreib mit Uriel. Beispiele:</p>
                <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>„Zeig mir die Leads-Pipeline"</li>
                  <li>„Was sind meine Zahlen heute?"</li>
                  <li>„Such den Kontakt Reichentrog"</li>
                  <li>„Öffne das Tracking"</li>
                </ul>
              </div>
            ) : null}
            {turns.map((t, i) => (
              <div key={i} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                <div
                  style={{
                    background: t.role === 'user' ? 'var(--ck-accent-dim)' : 'var(--ck-panel-2)',
                    border: '1px solid var(--ck-border)',
                    borderRadius: 8,
                    padding: '7px 11px',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  {t.role === 'uriel' ? (
                    <div className="ck-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{t.text}</ReactMarkdown></div>
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{t.text}</span>
                  )}
                </div>
                {t.actions && t.actions.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {t.actions.map((a, j) => (
                      <span
                        key={j}
                        className="ck-label"
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid var(--ck-border)',
                          color: a.ok ? 'var(--ck-text-2)' : 'var(--ck-warn)',
                        }}
                      >
                        {a.ok ? '✓' : '✕'} {a.summary}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px' }}>
                <span className="ck-dot ck-dot--pulse" />
                <span className="ck-label">Uriel arbeitet…</span>
              </div>
            ) : null}
            {error ? <p className="ck-label" style={{ color: 'var(--ck-warn)' }}>{error}</p> : null}
          </div>

          {/* Eingabe */}
          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--ck-border)' }}>
            {voice.sttSupported ? (
              <button
                className="ck-btn"
                onClick={onMic}
                aria-label={voice.listening ? 'Aufnahme stoppen' : 'Sprechen'}
                title={voice.listening ? 'Aufnahme stoppen' : 'Sprechen'}
                style={{ color: voice.listening ? 'var(--ck-accent)' : undefined, minWidth: 40 }}
              >
                {voice.listening ? '● …' : '🎤'}
              </button>
            ) : null}
            <textarea
              className="ck-input"
              style={{ flex: 1, resize: 'none', height: 60, lineHeight: 1.45 }}
              placeholder="Uriel fragen …"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(draft)
                }
              }}
              aria-label="Uriel-Eingabe"
            />
            <button className="ck-btn ck-btn--primary" disabled={busy || !draft.trim()} onClick={() => void send(draft)}>⏎</button>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Uriel schließen' : 'Uriel öffnen'}
        className="ck-uriel-fab"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1px solid var(--ck-accent)',
          background: open ? 'var(--ck-accent)' : 'var(--ck-panel)',
          color: open ? '#000' : 'var(--ck-accent)',
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        ✦
      </button>
    </>
  )
}
