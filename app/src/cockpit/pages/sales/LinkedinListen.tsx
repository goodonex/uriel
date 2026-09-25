import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCurrentBrandSlug } from '../../../hooks/useCurrentBrandSlug'
import { useErstnachrichten, type Erstnachricht } from '../../../hooks/useErstnachrichten'
import { useLeadKlassen } from '../../../hooks/useLeadKlassen'
import { useLeads } from '../../../hooks/useLeads'
import { useLinkedinThreads } from '../../../hooks/useLinkedinThreads'
import type { Lead, LeadEreignisTyp, LinkedinThread } from '../../../types/db'
import { KlassenBadge } from '../../components/KlassenBadge'
import { LeadAkte } from '../../components/linkedin/LeadAkte'
import { klassenRang, type LeadKlasse, type LeadKlassenInfo } from '../../lib/leadKlasse'
import { STATION_TITEL, leadStation, type Station } from '../../lib/leadStation'
import { useUiSetting } from '../../lib/uiSettings'

/**
 * Die LinkedIn-Listen (25.09.2026) — die erste Ansicht von „LinkedIn-Leads".
 *
 * Kevin: *„als erstes präsent die Listen, da ich direkt reingehen kann und
 * sagen kann, okay, ich will jetzt alle anklicken, die auf eine Antwort
 * warten … die zu Looms Ja gesagt haben … Einmal die Bewertung der Leads an
 * sich und dann nochmal den Stand."*
 *
 * Darum links EINE Spalte mit allen Listen in fester Reihenfolge — erst der
 * Stand (in der Reihenfolge, in der Kevin sie abarbeitet), dann die Bewertung
 * A/B/C, dann der Rest. Rechts die Leute der gewählten Liste; in einer
 * Stand-Liste lässt sich zusätzlich nach Klasse eingrenzen („A-Leads, die auf
 * Antwort warten"). Sortiert wird in Stand- und Bewertungslisten nach Güte
 * (Klasse, dann Punkte), bei gleicher Güte das zuletzt Angefasste zuerst.
 *
 * Hervorgegangen aus der Kontaktliste vom 17.09. — **keine neue Logik**: Die
 * Leads kommen aus `useLeads` (0076), die Stufe aus `leadStation`, die Klasse
 * aus `useLeadKlassen` (0092), die Maske ist die bestehende `LeadAkte`. Die
 * Akte hängt an der Adresse (`/sales/linkedin/lead/:leadId`), damit Zurück
 * sie schließt und ein Link wieder genau diesen Kontakt öffnet.
 */

const SEITE = 50

type ListenId =
  | 'antwort'
  | 'loom'
  | 'erst'
  | 'wartet'
  | 'kanalwechsel'
  | 'wiedervorlage'
  | 'anfrage'
  | 'klasse-A'
  | 'klasse-B'
  | 'klasse-C'
  | 'klasse-ohne'
  | 'markiert'
  | 'kunde'
  | 'aus'
  | 'alle'

interface ZeilenDaten {
  station: Station
  lead: Lead
  klasse: LeadKlasse | null
}

interface Liste {
  id: ListenId
  label: string
  /** Kurzer Satz unter dem Titel der rechten Spalte: was diese Liste ist. */
  wofuer: string
  passt: (z: ZeilenDaten) => boolean
  /** Nach Güte sortieren (Klasse, Punkte) statt nur nach Aktualität. */
  nachGuete: boolean
  /** In dieser Liste nach Klasse eingrenzen können. */
  klassenFilter: boolean
  /** Gemischte Liste — dann trägt jede Zeile ihren Stand als Chip. */
  standZeigen: boolean
}

const KANALWECHSEL: Station[] = ['instagram_faellig', 'pdf_faellig', 'email_faellig', 'postkarte_faellig', 'anruf_faellig']

/** Bewertungslisten zeigen nur, wer noch im Spiel ist — nicht Kunden oder Aussortierte. */
function imSpiel(s: Station): boolean {
  return s !== 'disqualifiziert' && s !== 'ruht' && s !== 'kunde'
}

const GRUPPEN: { titel: string; listen: Liste[] }[] = [
  {
    titel: 'Nach Stand',
    listen: [
      { id: 'antwort', label: 'Antwort da', wofuer: 'Hat geantwortet — du bist dran.', passt: (z) => z.station === 'antwort_da', nachGuete: true, klassenFilter: true, standZeigen: false },
      { id: 'loom', label: 'Loom zugesagt', wofuer: 'Hat Ja zur Analyse gesagt, das Loom ist noch offen.', passt: (z) => z.station === 'loom_offen', nachGuete: true, klassenFilter: true, standZeigen: false },
      { id: 'erst', label: 'Erstnachricht fällig', wofuer: 'Hat angenommen, noch nie angeschrieben.', passt: (z) => z.station === 'erstnachricht_faellig', nachGuete: true, klassenFilter: true, standZeigen: false },
      { id: 'wartet', label: 'Wartet auf Antwort', wofuer: 'Angeschrieben, Antwort steht aus — die Follow-ups laufen.', passt: (z) => z.station === 'wartet_auf_antwort', nachGuete: true, klassenFilter: true, standZeigen: false },
      { id: 'kanalwechsel', label: 'Kanalwechsel fällig', wofuer: 'Follow-ups durch — jetzt Instagram, PDF, E-Mail, Postkarte oder Anruf.', passt: (z) => KANALWECHSEL.includes(z.station), nachGuete: true, klassenFilter: true, standZeigen: true },
      { id: 'wiedervorlage', label: 'Wiedervorlage', wofuer: 'Du hast ein Datum gesetzt.', passt: (z) => z.station === 'wiedervorlage', nachGuete: true, klassenFilter: true, standZeigen: false },
      { id: 'anfrage', label: 'Anfrage läuft', wofuer: 'Vernetzungsanfrage raus, noch nicht angenommen.', passt: (z) => z.station === 'anfrage_offen', nachGuete: true, klassenFilter: true, standZeigen: false },
    ],
  },
  {
    titel: 'Nach Bewertung',
    listen: [
      { id: 'klasse-A', label: 'A — Wunschkunden', wofuer: 'Zahlt für Anzeigen, solide Firma, schwache Seite.', passt: (z) => z.klasse === 'A' && imSpiel(z.station), nachGuete: true, klassenFilter: false, standZeigen: true },
      { id: 'klasse-B', label: 'B — solide', wofuer: 'Solide Firma oder schon Anzeigen.', passt: (z) => z.klasse === 'B' && imSpiel(z.station), nachGuete: true, klassenFilter: false, standZeigen: true },
      { id: 'klasse-C', label: 'C — schwach', wofuer: 'Einzelkämpfer, neu oder unklar.', passt: (z) => z.klasse === 'C' && imSpiel(z.station), nachGuete: true, klassenFilter: false, standZeigen: true },
      { id: 'klasse-ohne', label: 'Noch nicht bewertet', wofuer: 'Profil noch nicht erhoben — darunter können A-Kunden sein.', passt: (z) => z.klasse === null && imSpiel(z.station), nachGuete: false, klassenFilter: false, standZeigen: true },
    ],
  },
  {
    titel: 'Weitere',
    listen: [
      { id: 'markiert', label: '★ Markiert', wofuer: 'Von dir markiert.', passt: (z) => z.lead.markiert, nachGuete: true, klassenFilter: true, standZeigen: true },
      { id: 'kunde', label: 'Kunden', wofuer: 'Über LinkedIn zum Kunden geworden.', passt: (z) => z.station === 'kunde', nachGuete: false, klassenFilter: false, standZeigen: false },
      { id: 'aus', label: 'Aussortiert / ruht', wofuer: 'Aussortiert oder Kadenz durch.', passt: (z) => z.station === 'disqualifiziert' || z.station === 'ruht', nachGuete: false, klassenFilter: true, standZeigen: true },
      { id: 'alle', label: 'Alle', wofuer: 'Alle Kontakte, zuletzt angefasst oben.', passt: () => true, nachGuete: false, klassenFilter: true, standZeigen: true },
    ],
  },
]

const ALLE_LISTEN: Liste[] = GRUPPEN.flatMap((g) => g.listen)

function istListenId(x: unknown): x is ListenId {
  return typeof x === 'string' && ALLE_LISTEN.some((l) => l.id === x)
}

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

interface Zeile extends ZeilenDaten {
  info: LeadKlassenInfo | null
  letzteAt: string
  letzteText: string
  erstnachricht: Erstnachricht | null
  thread: LinkedinThread | null
}

type KlassenWahl = 'alle' | LeadKlasse

export function LinkedinListen() {
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  const { leadId } = useParams<{ leadId: string }>()
  const leadsQuery = useLeads(slug)
  const erstnachrichten = useErstnachrichten(slug)
  const threads = useLinkedinThreads(slug)
  const { klassen } = useLeadKlassen(slug)

  // Die gewählte Liste überlebt den Besuch — man kommt dorthin zurück, wo man war.
  const { wert: listeRoh, setzen: setzeListe } = useUiSetting<string>('linkedin.liste', 'antwort')
  const listenId: ListenId = istListenId(listeRoh) ? listeRoh : 'antwort'
  const liste = ALLE_LISTEN.find((l) => l.id === listenId) ?? ALLE_LISTEN[0]

  const [klassenWahl, setKlassenWahl] = useState<KlassenWahl>('alle')
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
    return leadsQuery.leads.map((lead) => {
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
      const info = klassen.get(lead.id) ?? null
      return { lead, station, klasse: info?.klasse ?? null, info, letzteAt, letzteText, erstnachricht: erst, thread }
    })
  }, [leadsQuery.leads, leadsQuery.ereignisseJeLead, threadsJeLead, erstJeLead, klassen, jetzt])

  const zaehler = useMemo(() => {
    const z = new Map<ListenId, number>()
    for (const l of ALLE_LISTEN) z.set(l.id, zeilen.filter((r) => l.passt(r)).length)
    return z
  }, [zeilen])

  const inListe = useMemo(() => zeilen.filter((r) => liste.passt(r)), [zeilen, liste])

  const klassenZaehler = useMemo(() => {
    const z: Record<KlassenWahl, number> = { alle: inListe.length, A: 0, B: 0, C: 0 }
    for (const r of inListe) if (r.klasse) z[r.klasse]++
    return z
  }, [inListe])

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    const treffer = inListe.filter((r) => {
      if (liste.klassenFilter && klassenWahl !== 'alle' && r.klasse !== klassenWahl) return false
      if (!q) return true
      return (
        r.lead.name.toLowerCase().includes(q) ||
        r.lead.headline.toLowerCase().includes(q) ||
        (r.erstnachricht?.firma ?? '').toLowerCase().includes(q)
      )
    })
    const nachZeit = (a: Zeile, b: Zeile) => b.letzteAt.localeCompare(a.letzteAt)
    return treffer.sort(
      liste.nachGuete
        ? (a, b) =>
            klassenRang(a.klasse) - klassenRang(b.klasse) ||
            (b.info?.punkte ?? -1) - (a.info?.punkte ?? -1) ||
            nachZeit(a, b)
        : nachZeit,
    )
  }, [inListe, liste, klassenWahl, suche])

  const sichtbar = gefiltert.slice(0, anzahl)
  const offen = leadId ? zeilen.find((r) => r.lead.id === leadId) ?? null : null
  const schliessen = () => navigate('/sales/linkedin')

  const waehle = (id: ListenId) => {
    setzeListe(id)
    setKlassenWahl('alle')
    setAnzahl(SEITE)
  }

  return (
    <div className="ck-li-listen">
      {/* Links: alle Listen in fester Reihenfolge */}
      <nav aria-label="LinkedIn-Listen" className="ck-li-listen-wahl">
        {GRUPPEN.map((g) => (
          <div key={g.titel} className="ck-li-listen-gruppe">
            <div className="ck-label" style={{ padding: '0 10px 4px', color: 'var(--ck-text-3)' }}>
              {g.titel}
            </div>
            {g.listen.map((l) => {
              const n = zaehler.get(l.id) ?? 0
              return (
                <button
                  key={l.id}
                  type="button"
                  className="ck-li-liste"
                  aria-current={l.id === listenId ? 'true' : undefined}
                  onClick={() => waehle(l.id)}
                >
                  <span className="ck-li-liste-name">{l.label}</span>
                  <span className="ck-li-liste-zahl" data-leer={n === 0 ? 'true' : undefined}>
                    {leadsQuery.loading ? '' : n}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Rechts: die Leute der gewählten Liste */}
      <section aria-label={liste.label} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>{liste.label}</h2>
            <span className="ck-zahl" style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
              {leadsQuery.loading ? '' : gefiltert.length}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ck-text-2)', marginTop: 2 }}>{liste.wofuer}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="ck-input"
            value={suche}
            onChange={(e) => {
              setSuche(e.target.value)
              setAnzahl(SEITE)
            }}
            placeholder="Name, Firma, Position …"
            aria-label="In dieser Liste suchen"
            style={{ flex: '1 1 220px', minWidth: 0 }}
          />
          {liste.klassenFilter ? (
            <div className="ck-segmente" role="group" aria-label="Nach Klasse eingrenzen" style={{ borderBottom: 'none' }}>
              {(['alle', 'A', 'B', 'C'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="ck-segment"
                  aria-pressed={klassenWahl === k}
                  onClick={() => {
                    setKlassenWahl(k)
                    setAnzahl(SEITE)
                  }}
                  style={{ padding: '6px 10px', minHeight: 36 }}
                >
                  {k === 'alle' ? 'Alle' : k}
                  <span className="ck-segment-zahl">{klassenZaehler[k]}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {leadsQuery.error ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{leadsQuery.error}</div> : null}

        {leadsQuery.loading ? (
          <div className="ck-panel" style={{ padding: '24px 16px', fontSize: 13, color: 'var(--ck-text-2)' }}>Lädt …</div>
        ) : gefiltert.length === 0 ? (
          <div className="ck-panel" style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-2)' }}>
            {suche ? 'Kein Kontakt passt zur Suche.' : 'Diese Liste ist gerade leer.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sichtbar.map((r) => (
              <button
                key={r.lead.id}
                type="button"
                className="ck-panel ck-zeile-karte"
                onClick={() => navigate(`/sales/linkedin/lead/${r.lead.id}`)}
                aria-label={`${r.lead.name} öffnen`}
              >
                <span className="ck-zeile-karte-text">
                  <span className="ck-zeile-karte-titel" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <KlassenBadge klasse={r.info?.klasse} grund={r.info?.grund} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.lead.markiert ? '★ ' : ''}
                      {r.lead.name}
                    </span>
                  </span>
                  <span className="ck-zeile-karte-meta">
                    {r.letzteText} · {wannKurz(r.letzteAt, jetzt.getTime())}
                    {r.erstnachricht?.firma || r.lead.headline ? ` · ${r.erstnachricht?.firma || r.lead.headline}` : ''}
                  </span>
                </span>
                {/* In einer reinen Stand-Liste steht der Stand schon im Titel —
                    der Chip trägt nur dort Information, wo die Liste gemischt ist. */}
                {liste.standZeigen ? (
                  <span className="ck-chip" style={{ flexShrink: 0 }}>
                    {STATION_TITEL[r.station]}
                  </span>
                ) : null}
              </button>
            ))}
            {gefiltert.length > sichtbar.length ? (
              <button type="button" className="ck-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setAnzahl((n) => n + SEITE)}>
                {SEITE} weitere zeigen ({gefiltert.length - sichtbar.length} übrig)
              </button>
            ) : null}
          </div>
        )}
      </section>

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
