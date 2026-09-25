import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Badge, BadgeText } from './Badge'
import { BereichIcon, type BereichIconName } from './BereichIcon'
import { AppGrid } from './home/AppGrid'
import { PALETTEN_BEREICHE, bereichIcon } from '../lib/bereiche'
import { useSocialUnread } from '../lib/socialApi'
import { MOBILE_MEDIA_QUERY } from '../../hooks/useViewport'
import { Benachrichtigungen } from './Benachrichtigungen'
import { useUiSetting } from '../lib/uiSettings'
import { PROGRAMME, type Programm } from '../lib/programme'

interface NavItem {
  to: string
  label: string
  icon: BereichIconName
  paths?: string[]
}

/**
 * Die Leiste (Umbau 25.09.2026, Kevins Diktat):
 *
 * - **Arbeit** — Cockpit · Sales · Projekte · Tracking. „Heute" und Agenten
 *   sind Reiter im Cockpit geworden („die Heute-Seite benutze ich fast gar
 *   nicht"). Das ist zugleich die mobile Dock-Belegung (vier Zeichen + Mehr).
 * - **Programme** — Gabriel, Jophiel, Laplace: ein Klick, neuer Tab. Gabriel
 *   steht dort, wo vorher Content und Ads standen.
 * - **Identität** ganz unten, durch eine Linie abgesetzt: nichts Operatives.
 *
 * Die Zeichen kommen weiter aus der Bereichs-Registry (`bereiche.ts`, O18).
 */
const ARBEIT: NavItem[] = [
  {
    to: '/cockpit',
    label: 'Cockpit',
    icon: bereichIcon('/cockpit'),
    paths: ['/cockpit', '/aufgaben', '/termine', '/freigaben', '/agenten'],
  },
  { to: '/sales', label: 'Sales', icon: bereichIcon('/sales'), paths: ['/sales', '/linkedin'] },
  { to: '/projekte', label: 'Projekte', icon: bereichIcon('/projekte') },
  { to: '/tracking', label: 'Tracking', icon: bereichIcon('/tracking') },
]

const IDENTITAET: NavItem = { to: '/identitaet', label: 'Identität', icon: bereichIcon('/identitaet') }

/** Ein Schwester-Programm: echter Link, neuer Tab — kein Router-Ziel. */
function ProgrammEintrag({ p, nurZeichen }: { p: Programm; nurZeichen: boolean }) {
  return (
    <a
      href={p.url}
      target="_blank"
      rel="noopener noreferrer"
      className="ck-nav-item"
      title={`${p.label} — ${p.zweck} (öffnet einen neuen Tab)`}
    >
      <span aria-hidden className="ck-nav-icon">
        <BereichIcon name={p.icon} />
      </span>
      <span className={`ck-nav-label${nurZeichen ? ' ck-nur-vorlesen' : ''}`}>
        {p.label}
        <span className="ck-nur-vorlesen"> (öffnet einen neuen Tab)</span>
      </span>
      <span aria-hidden className="ck-nav-extern-pfeil">
        ↗
      </span>
    </a>
  )
}

/**
 * Bottom-Bar oder Rail? Eine Grenze für alle (O10): `MOBILE_MEDIA_QUERY` ist
 * derselbe Wert, den `useViewport().isMobile` und die `@media`-Blöcke in
 * cockpit.css benutzen. Bis zum 06.08. stand hier 900 und in useViewport 768.
 */
function useBottomBar(): boolean {
  const [schmal, setSchmal] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY)
    // Zusätzlich auf resize/orientationchange hören und jedes Mal neu abfragen:
    // das change-Event der MediaQuery kommt nicht überall verlässlich an
    // (u.a. bei Viewport-Umschaltung im Test), dann bliebe die Bar hängen.
    const pruefe = () => setSchmal(mq.matches)
    mq.addEventListener('change', pruefe)
    window.addEventListener('resize', pruefe, { passive: true })
    window.addEventListener('orientationchange', pruefe, { passive: true })
    pruefe()
    return () => {
      mq.removeEventListener('change', pruefe)
      window.removeEventListener('resize', pruefe)
      window.removeEventListener('orientationchange', pruefe)
    }
  }, [])
  return schmal
}

/**
 * Der Doppelpfeil des Einklapp-Knopfs. Bewusst hier und nicht in
 * `BereichIcon`: Das ist kein Bereich, sondern eine Bedienung — die Registry
 * traegt nur Ziele.
 */
function KlappZeichen({ eingeklappt }: { eingeklappt: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={17}
      height={17}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: eingeklappt ? 'scaleX(-1)' : undefined }}
    >
      <path d="M14.5 7.5 10 12l4.5 4.5M19 7.5 14.5 12l4.5 4.5" />
    </svg>
  )
}

function istAktiv(item: NavItem, pathname: string): boolean {
  const pfade = item.paths ?? [item.to]
  return pfade.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Ein Nav-Ziel. Im Dock (mobil) trägt es nur sein Zeichen — der Bereichsname
 * bleibt für Vorleseprogramme im Baum, statt ersatzlos zu verschwinden.
 */
function NavEintrag({ item, badge, nurZeichen }: { item: NavItem; badge: number; nurZeichen: boolean }) {
  const loc = useLocation()
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `ck-nav-item${(item.paths ? istAktiv(item, loc.pathname) : isActive) ? ' active' : ''}`
      }
    >
      <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
        <BereichIcon name={item.icon} />
        <Badge anzahl={badge} />
      </span>
      <span className={`ck-nav-label${nurZeichen ? ' ck-nur-vorlesen' : ''}`}>
        {item.label}
        <BadgeText anzahl={badge} />
      </span>
    </NavLink>
  )
}

/**
 * Die Bibliothek hinter „Mehr" (O18, Zug 5) — ein Tipp öffnet, ein Tipp wählt.
 *
 * Bis dahin standen hier vier Zeilen (nur NACHSCHLAGEN). Jetzt liegt hier
 * **alles, was man machen kann**: dasselbe Kachel-Grid wie auf dem Homescreen,
 * aber vollständig — auch die vier Bereiche, die schon in der Bar stehen. Das
 * ist der Unterschied zwischen einem Rest-Menü und einer Bibliothek.
 */
function MehrSheet({ onClose, badgeFuer }: { onClose: () => void; badgeFuer: (to: string) => number }) {
  const navigate = useNavigate()
  const loc = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="ck-mehr-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ck-mehr-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Bibliothek"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ck-label" style={{ padding: '2px 4px 8px' }}>
          Bibliothek
        </div>
        {/* Wächst die Registry, scrollt das Grid — der Schalter darunter bleibt
            erreichbar, statt unter den unteren Bildschirmrand zu rutschen. */}
        <div style={{ overflowY: 'auto', minHeight: 0 }}>
          <AppGrid
            bereiche={PALETTEN_BEREICHE}
            badgeFuer={badgeFuer}
            istAktiv={(path) => istAktiv({ to: path, label: '', icon: 'raute' }, loc.pathname)}
            onWaehle={(path) => {
              navigate(path)
              onClose()
            }}
          />
        </div>

        {/* Die Schwester-Programme auch am Handy (25.09.2026) — ein Tipp, neuer Tab. */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, flexShrink: 0 }}>
          {PROGRAMME.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ck-btn"
              style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', minHeight: 44 }}
            >
              {p.label} <span aria-hidden>↗</span>
            </a>
          ))}
        </div>

        {/* O3, Zug 5: Der Schalter fuer Benachrichtigungen gehoert dorthin, wo
            man ihn sucht, wenn der Morgen-Push mal ausbleibt — und nicht nur
            auf /morgen, das man ohne Push gar nicht erst aufmacht. */}
        <div style={{ borderTop: '1px solid var(--ck-border)', marginTop: 10, paddingTop: 10, flexShrink: 0 }}>
          <Benachrichtigungen kompakt />
        </div>
      </div>
    </div>
  )
}

export function NavRail() {
  const socialUnread = useSocialUnread()
  const bottomBar = useBottomBar()
  const loc = useLocation()

  /**
   * Die Rail laesst sich einklappen (28.08.2026, Blaupause
   * `docs/wargames/sales-canvas-v2.md`, Zug 3). Kevins Satz dazu: *„Die
   * Seitenleiste sollte einklappbar sein links."* Die 96 px, die dabei
   * freiwerden, gehen an den Inhalt — auf der Sales-Seite genau dorthin, wo
   * das leere rechte Viertel war.
   *
   * Der Zustand liegt in `ui_settings` (0068), damit er das Loeschen-und-neu-
   * Hinzufuegen der PWA ueberlebt. **`=== true` statt Truthiness:** Der Wert
   * kommt aus einer Key-Value-Tabelle und war dort schon alles Moegliche.
   *
   * **Nur am Desktop.** Mobil ist die Rail ein Dock aus fuenf Zeichen; ein
   * Einklapp-Knopf waere dort ein sechster Eintrag und wuerde Sales aus dem
   * Daumenbereich draengen — dieselbe Begruendung, aus der NACHSCHLAGEN mobil
   * hinter „Mehr" liegt.
   */
  const { wert: klappRoh, setzen: setzeKlapp } = useUiSetting<boolean>('navRailEingeklappt', false)
  const eingeklappt = !bottomBar && klappRoh === true
  // Gemerkt wird die Route, auf der geöffnet wurde: damit schließt sich das
  // Sheet bei jedem Bereichswechsel von selbst (die Bar bleibt ja tippbar,
  // während es offen steht) — ohne Effekt, der Zustand nachzieht.
  const [mehrOffenBei, setMehrOffenBei] = useState<string | null>(null)
  const mehrOffen = mehrOffenBei === loc.pathname

  // Der Content-Badge (ungelesene Social-Nachrichten) hängt seit dem Umzug
  // nach Gabriel am „Mehr"-Knopf bzw. an der Content-Kachel der Bibliothek.
  const badgeFuer = (to: string) => (to === '/content' ? socialUnread : 0)

  const mehrBadge = bottomBar ? socialUnread : 0
  const mehrAktiv =
    bottomBar && !ARBEIT.some((i) => istAktiv(i, loc.pathname)) && loc.pathname !== '/'
  const nurZeichen = bottomBar || eingeklappt

  return (
    <>
      <nav
        id="ck-nav-rail"
        aria-label="Cockpit-Bereiche"
        className="ck-nav-rail"
        data-eingeklappt={eingeklappt ? 'true' : undefined}
      >
        {ARBEIT.map((item) => (
          <NavEintrag
            key={item.to}
            item={item}
            badge={badgeFuer(item.to)}
            /* Eingeklappt bleibt der Bereichsname im Baum stehen (`ck-nur-vorlesen`),
               statt ersatzlos zu verschwinden — dieselbe Regel wie im Dock. */
            nurZeichen={nurZeichen}
          />
        ))}
        {!bottomBar ? (
          <>
            <div className="ck-nav-trenner" role="presentation" />
            <div className="ck-nav-gruppe" aria-hidden>
              Programme
            </div>
            {PROGRAMME.map((p) => (
              <ProgrammEintrag key={p.id} p={p} nurZeichen={nurZeichen} />
            ))}
            {/* Identität steht ganz unten, abgesetzt: nichts Operatives. */}
            <div className="ck-nav-trenner" role="presentation" style={{ marginTop: 'auto' }} />
            <NavEintrag item={IDENTITAET} badge={0} nurZeichen={nurZeichen} />
          </>
        ) : null}
        {!bottomBar ? (
          <button
            type="button"
            className="ck-nav-item"
            style={{ background: 'none' }}
            aria-expanded={!eingeklappt}
            aria-controls="ck-nav-rail"
            title={eingeklappt ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
            onClick={() => setzeKlapp(!eingeklappt)}
          >
            <span aria-hidden className="ck-nav-icon">
              <KlappZeichen eingeklappt={eingeklappt} />
            </span>
            <span className={`ck-nav-label${eingeklappt ? ' ck-nur-vorlesen' : ''}`}>
              {eingeklappt ? 'Ausklappen' : 'Einklappen'}
            </span>
          </button>
        ) : null}
        {bottomBar ? (
          <button
            type="button"
            className={`ck-nav-item${mehrAktiv ? ' active' : ''}`}
            style={{ background: 'none' }}
            aria-haspopup="dialog"
            aria-expanded={mehrOffen}
            onClick={() => setMehrOffenBei(mehrOffen ? null : loc.pathname)}
          >
            <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
              <BereichIcon name="mehr" />
              <Badge anzahl={mehrBadge} />
            </span>
            <span className="ck-nav-label ck-nur-vorlesen">
              Mehr
              <BadgeText anzahl={mehrBadge} />
            </span>
          </button>
        ) : null}
      </nav>
      {bottomBar && mehrOffen ? (
        <MehrSheet onClose={() => setMehrOffenBei(null)} badgeFuer={badgeFuer} />
      ) : null}
    </>
  )
}
