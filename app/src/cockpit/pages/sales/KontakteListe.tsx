import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../../hooks/useCurrentBrandSlug'
import { useErstnachrichten, type Erstnachricht } from '../../../hooks/useErstnachrichten'
import { useLeads } from '../../../hooks/useLeads'
import { useLinkedinThreads } from '../../../hooks/useLinkedinThreads'
import type { Lead, LeadEreignisTyp, LinkedinThread } from '../../../types/db'
import { LeadAkte } from '../../components/linkedin/LeadAkte'
import { STATION_TITEL, leadStation, type Station } from '../../lib/leadStation'

/**
 * Alle LinkedIn-Kontakte als Liste (17.09.2026).
 *
 * Kevins Auftrag: *„so wie wir jetzt diese Leads da drin haben und eine Liste
 * für die haben, so hätte ich ganz gerne eine neue Liste, nur mit diesen ganzen
 * LinkedIn-Kontakten"* — mit den zuletzt angefassten oben und einem Klick in
 * eine richtige Maske. Anlass: eine versehentlich abgehakte Erstnachricht, deren
 * Text danach nur noch im Vault stand.
 *
 * **Keine neue Logik.** Die Leads kommen aus `useLeads` (0076), die Stufe aus
 * `leadStation`, die Maske ist die bestehende `LeadAkte`. Hier wird nur
 * sortiert, gesucht und gefiltert. Die Akte hängt an der Adresse
 * (`/sales/kontakte/:leadId`), damit Zurück sie schließt und ein Link darauf
 * wieder genau diesen Kontakt öffnet.
 */

const SEITE = 50

type FilterId = 'alle' | 'antwort' | 'erst' | 'wartet' | 'nachfassen' | 'wiedervorlage' | 'markiert' | 'anfrage' | 'aus'

const FILTER: { id: FilterId; label: string; passt: (station: Station, lead: Lead) => boolean }[] = [
  { id: 'alle', label: 'Alle', passt: () => true },
  { id: 'antwort', label: 'Antwort da', passt: (s) => s === 'antwort_da' || s === 'loom_offen' },
  { id: 'erst', label: 'Erstnachricht fällig', passt: (s) => s === 'erstnachricht_faellig' },
  { id: 'wartet', label: 'Wartet auf Antwort', passt: (s) => s === 'wartet_auf_antwort' },
  {
    id: 'nachfassen',
    label: 'Kanalwechsel fällig',
    passt: (s) =>
      s === 'instagram_faellig' || s === 'pdf_faellig' || s === 'email_faellig' || s === 'postkarte_faellig' || s === 'anruf_faellig',
  },
  { id: 'wiedervorlage', label: 'Wiedervorlage', passt: (s) => s === 'wiedervorlage' },
  { id: 'markiert', label: 'Markiert', passt: (_s, l) => l.markiert },
  { id: 'anfrage', label: 'Anfrage läuft', passt: (s) => s === 'anfrage_offen' },
  { id: 'aus', label: 'Aussortiert / ruht', passt: (s) => s === 'disqualifiziert' || s === 'ruht' },
]

const TAETIGKEIT: Partial<Record<LeadEreignisTyp, string>> = {
  anfrage: 'Anfrage raus',
  angenommen: 'Hat angenommen',
  erstnachricht: 'Erstnachricht raus',
  followup: 'Nachgefasst',
  antwort_erhalten: 'Hat geantwortet',
  loom_zugesagt: 'Loom zugesagt',
  loom_abgelehnt: 'Loom abgelehnt',
  loom_gesendet: 'Loom raus',
  inmail: 'InMail raus',
  email: 'E-Mail raus',
  postkarte: 'Postkarte raus',
  anruf: 'Angerufen',
  instagram: 'Instagram raus',
  pdf: 'Analyse-PDF raus',
  uebersprungen: 'Stufe umgehängt',
  wiedervorlage_gesetzt: 'Wiedervorlage gesetzt',
  disqualifiziert: 'Aussortiert',
  reaktiviert: 'Wieder aufgenommen',
  notiz: 'Notiz',
}

function wannKurz(iso: string, jetzt: number): string {
  const ms = jetzt - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  const min = Math.floor(ms / 60_000)
  if (min < 60) return min <= 1 ? 'gerade eben' : `vor ${min} Min.`
  const std = Math.floor(min / 60)
  if (std < 24) return `vor ${std} Std.`
  const tage = Math.floor(std / 24)
  if (tage === 1) return 'gestern'
  if (tage < 30) return `vor ${tage} Tagen`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function namensSchluessel(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(dipl|jur|ing|kfm|dr|prof|mba|ll\.?m)\b\.?/g, ' ')
    .replace(/[^a-zäöüß]+/g, ' ')
    .trim()
}

interface Zeile {
  lead: Lead
  station: Station
  letzteAt: string
  letzteText: string
  erstnachricht: Erstnachricht | null
  thread: LinkedinThread | null
}

export function KontakteListe() {
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const leadsQuery = useLeads(slug)
  const erstnachrichten = useErstnachrichten(slug)
  const threads = useLinkedinThreads(slug)

  const [filterId, setFilterId] = useState<FilterId>('alle')
  const [suche, setSuche] = useState('')
  const [anzahl, setAnzahl] = useState(SEITE)
  const jetzt = useMemo(() => new Date(), [])

  const threadsJeLead = useMemo(() => {
    const karte = new Map<string, LinkedinThread>()
    for (const t of threads.items) if (t.lead_id) karte.set(t.lead_id, t)
    return karte
  }, [threads.items])

  /**
   * Erstnachricht je Lead: zuerst über `lead_id`, sonst über den Namen — ältere
   * Zeilen aus dem Vault-Spiegel sind nicht alle verknüpft. Der Name wird ohne
   * Titel verglichen („Dipl. Jur. Wolfgang Bauer" = „Wolfgang Bauer").
   */
  const erstJeLead = useMemo(() => {
    const perId = new Map<string, Erstnachricht>()
    const perName = new Map<string, Erstnachricht>()
    for (const e of erstnachrichten.items) {
      if (e.lead_id) perId.set(e.lead_id, e)
      perName.set(namensSchluessel(e.name), e)
    }
    return { perId, perName }
  }, [erstnachrichten.items])

  const zeilen = useMemo<Zeile[]>(() => {
    const liste = leadsQuery.leads.map((lead) => {
      const ereignisse = leadsQuery.ereignisseJeLead.get(lead.id) ?? []
      const thread = threadsJeLead.get(lead.id) ?? null
      const erst = erstJeLead.perId.get(lead.id) ?? erstJeLead.perName.get(namensSchluessel(lead.name)) ?? null
      const station = leadStation(
        {
          lead_status: lead.lead_status,
          wiedervorlage_am: lead.wiedervorlage_am,
          ereignisse: ereignisse.map((e) => ({ typ: e.typ, at: e.at, details: e.details })),
          thread,
        },
        jetzt,
      ).station

      // „Zuletzt angefasst" = das jüngste, was wirklich passiert ist: ein
      // Ereignis oder eine abgehakte Erstnachricht. `updated_at` zählt bewusst
      // nicht — der Sync stempelt ihn bei jedem Abgleich (17.09.: 660 Leads am
      // selben Tag), die Liste würde sonst Rauschen nach oben sortieren.
      let letzteAt = lead.first_seen_at
      let letzteText = 'Kontakt aufgenommen'
      const juengstes = ereignisse[0]
      if (juengstes && juengstes.at > letzteAt) {
        letzteAt = juengstes.at
        letzteText = TAETIGKEIT[juengstes.typ] ?? 'Aktivität'
      }
      if (erst?.sent_at && erst.status !== 'offen' && erst.sent_at > letzteAt) {
        letzteAt = erst.sent_at
        letzteText = erst.status === 'gesendet' ? 'Erstnachricht abgehakt' : 'Erstnachricht übersprungen'
      }
      return { lead, station, letzteAt, letzteText, erstnachricht: erst, thread }
    })
    liste.sort((a, b) => b.letzteAt.localeCompare(a.letzteAt))
    return liste
  }, [leadsQuery.leads, leadsQuery.ereignisseJeLead, threadsJeLead, erstJeLead, jetzt])

  const zaehler = useMemo(() => {
    const z = new Map<FilterId, number>()
    for (const f of FILTER) z.set(f.id, zeilen.filter((r) => f.passt(r.station, r.lead)).length)
    return z
  }, [zeilen])

  const gefiltert = useMemo(() => {
    const filter = FILTER.find((f) => f.id === filterId) ?? FILTER[0]
    const q = suche.trim().toLowerCase()
    return zeilen.filter((r) => {
      if (!filter.passt(r.station, r.lead)) return false
      if (!q) return true
      return (
        r.lead.name.toLowerCase().includes(q) ||
        r.lead.headline.toLowerCase().includes(q) ||
        (r.erstnachricht?.firma ?? '').toLowerCase().includes(q)
      )
    })
  }, [zeilen, filterId, suche])

  const sichtbar = gefiltert.slice(0, anzahl)
  const offen = leadId ? zeilen.find((r) => r.lead.id === leadId) ?? null : null
  const schliessen = () => navigate('/sales/kontakte')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>LinkedIn-Kontakte</span>
        <span className="ck-zahl" style={{ fontSize: 12, color: 'var(--ck-text-2)' }}>
          {gefiltert.length} von {zeilen.length} · zuletzt angefasst oben
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {FILTER.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`ck-btn${f.id === filterId ? ' ck-btn--primary' : ''}`}
            onClick={() => {
              setFilterId(f.id)
              setAnzahl(SEITE)
            }}
            aria-pressed={f.id === filterId}
            style={{ flexShrink: 0 }}
          >
            {f.label} · {zaehler.get(f.id) ?? 0}
          </button>
        ))}
      </div>

      <input
        className="ck-input"
        value={suche}
        onChange={(e) => {
          setSuche(e.target.value)
          setAnzahl(SEITE)
        }}
        placeholder="Name, Firma, Position …"
        aria-label="Kontakte durchsuchen"
        style={{ width: '100%' }}
      />

      {leadsQuery.error ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{leadsQuery.error}</div> : null}

      {leadsQuery.loading ? (
        <div className="ck-panel" style={{ padding: '24px 16px', fontSize: 13, color: 'var(--ck-text-2)' }}>
          Lädt …
        </div>
      ) : gefiltert.length === 0 ? (
        <div className="ck-panel" style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-2)' }}>
          Kein Kontakt passt dazu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sichtbar.map((r) => (
            <button
              key={r.lead.id}
              type="button"
              className="ck-panel ck-zeile-karte"
              onClick={() => navigate(`/sales/kontakte/${r.lead.id}`)}
              aria-label={`${r.lead.name} öffnen`}
            >
              <span className="ck-zeile-karte-text">
                <span className="ck-zeile-karte-titel">
                  {r.lead.markiert ? '★ ' : ''}
                  {r.lead.name}
                </span>
                <span className="ck-zeile-karte-meta">
                  {r.letzteText} · {wannKurz(r.letzteAt, jetzt.getTime())}
                  {r.erstnachricht?.firma || r.lead.headline ? ` · ${r.erstnachricht?.firma || r.lead.headline}` : ''}
                </span>
              </span>
              <span className="ck-chip" style={{ flexShrink: 0 }}>
                {STATION_TITEL[r.station]}
              </span>
            </button>
          ))}
          {gefiltert.length > sichtbar.length ? (
            <button type="button" className="ck-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setAnzahl((n) => n + SEITE)}>
              {SEITE} weitere zeigen ({gefiltert.length - sichtbar.length} übrig)
            </button>
          ) : null}
        </div>
      )}

      {offen ? (
        <LeadAkte
          key={offen.lead.id}
          lead={offen.lead}
          ereignisse={leadsQuery.ereignisseJeLead.get(offen.lead.id) ?? []}
          thread={offen.thread}
          erstnachricht={offen.erstnachricht}
          onErstnachrichtStatus={
            offen.erstnachricht ? (status) => erstnachrichten.setzeStatus(offen.erstnachricht!.id, status) : undefined
          }
          onClose={schliessen}
          onWiedervorlage={(datum, grund) => leadsQuery.setzeWiedervorlage(offen.lead.id, datum, grund)}
          onDisqualifizieren={(grund) => leadsQuery.disqualifiziere(offen.lead.id, grund)}
          onReaktivieren={() => leadsQuery.reaktiviere(offen.lead.id)}
          onMarkieren={(markiert) => leadsQuery.markiere(offen.lead.id, markiert)}
          onNotiz={(notiz) => leadsQuery.speichereNotiz(offen.lead.id, notiz)}
          onProtokolliere={(typ) => leadsQuery.protokolliere(offen.lead.id, typ)}
          onUmhaengen={(nach, grund) =>
            leadsQuery.protokolliere(offen.lead.id, 'uebersprungen', { von: offen.station, nach, grund })
          }
        />
      ) : null}
    </div>
  )
}
