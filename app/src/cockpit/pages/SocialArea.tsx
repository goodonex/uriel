import { useEffect, useMemo, useState } from 'react'
import {
  fetchSocialWeeks,
  getSeenWeeks,
  markWeekSeen,
  socialFileUrl,
  type SocialWeek,
} from '../lib/socialApi'

/**
 * Content-Area (Cockpit /content): die wöchentlichen Content-Batches der
 * Content-Engine landen hier als „Nachricht" statt als E-Mail. Quelle sind die
 * self-contained woche-<KW>.html unter 04_social/content-engine/weekly/, gelesen
 * über den lokalen Runner (funktioniert, wenn das Cockpit lokal läuft — wie /ads).
 */
const DATE_FMT = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })

export function SocialArea() {
  const [weeks, setWeeks] = useState<SocialWeek[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeWeek, setActiveWeek] = useState<string | null>(null)
  const [seenTick, setSeenTick] = useState(0)

  useEffect(() => {
    fetchSocialWeeks()
      .then((w) => {
        setWeeks(w)
        // Neueste Woche direkt öffnen (und als gesehen markieren).
        if (w[0]) {
          setActiveWeek(w[0].week)
          markWeekSeen(w[0].week)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const seen = useMemo(() => getSeenWeeks(), [seenTick, weeks])
  const active = useMemo(() => weeks?.find((w) => w.week === activeWeek) ?? null, [weeks, activeWeek])

  const open = (w: SocialWeek) => {
    setActiveWeek(w.week)
    markWeekSeen(w.week)
    setSeenTick((t) => t + 1)
  }

  if (error) {
    return (
      <div style={{ maxWidth: 820 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Content · Wochen-Batches</div>
        <div
          className="ck-panel"
          style={{ padding: '12px 14px', border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5 }}
        >
          Runner nicht erreichbar: {error}
          <div className="ck-label" style={{ marginTop: 6, color: 'var(--ck-text-3)' }}>
            Der Content-Bereich liest die Wochen-Pakete lokal über den Runner — starte das Cockpit
            mit <code>npm run cockpit:full</code>, dann erscheinen die Batches hier.
          </div>
        </div>
      </div>
    )
  }
  if (!weeks) return <p className="ck-label">Lade…</p>

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Content · Wochen-Batches</div>
        <div className="ck-label" style={{ marginTop: 2 }}>
          {weeks.length > 0
            ? `${weeks.length} Woche${weeks.length === 1 ? '' : 'n'} · vom Montags-Lauf geliefert`
            : 'Noch kein Batch — der Montags-Lauf legt hier die Woche als klickbares Paket ab'}
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Sobald der Montags-Lauf (Content-Engine) eine Woche gebaut hat, taucht sie hier als
            Nachricht auf — sichten, auswählen, selbst posten.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 16, alignItems: 'start' }}>
          {/* Liste = „Posteingang" */}
          <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {weeks.map((w) => {
              const isNew = !seen.has(w.week)
              const isActive = w.week === activeWeek
              return (
                <button
                  key={w.week}
                  onClick={() => open(w)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 13px',
                    background: isActive ? 'var(--ck-border)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--ck-border)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {isNew ? (
                      <span
                        aria-label="neu"
                        style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--ck-accent)', flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ width: 7, flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 13, fontWeight: isNew ? 600 : 500 }}>{w.week}</span>
                    {isNew ? (
                      <span
                        className="ck-label"
                        style={{ marginLeft: 'auto', color: 'var(--ck-accent)', fontSize: 10 }}
                      >
                        neu
                      </span>
                    ) : null}
                  </span>
                  <span className="ck-label" style={{ display: 'block', marginLeft: 14, marginTop: 3 }}>
                    {w.postsCount > 0 ? `${w.postsCount} Posts · ` : ''}
                    {w.mtime ? DATE_FMT.format(new Date(w.mtime)) : ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Vorschau der self-contained Wochen-HTML */}
          <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
            {active ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderBottom: '1px solid var(--ck-border)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{active.title}</span>
                  <a
                    className="ck-btn"
                    style={{ fontSize: 11.5, textDecoration: 'none' }}
                    href={socialFileUrl(active.htmlPath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    In neuem Tab ↗
                  </a>
                </div>
                <iframe
                  key={active.week}
                  src={socialFileUrl(active.htmlPath)}
                  title={active.title}
                  style={{ width: '100%', height: '72vh', border: 'none', background: '#fff', display: 'block' }}
                />
              </>
            ) : (
              <p className="ck-label" style={{ padding: 16 }}>Woche links wählen.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
