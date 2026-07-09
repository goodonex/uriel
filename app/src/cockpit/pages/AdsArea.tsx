import { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { AdCard } from '../components/ads/AdCard'
import { AdDetailPanel } from '../components/ads/AdDetailPanel'
import type { Kunde } from '../lib/adsApi'
import { AD_STATUS_LABEL, fetchKunden, kundenFileUrl } from '../lib/adsApi'
import { useAdManifest } from '../lib/useAdManifest'

/**
 * Ads-Area (Ablage + Review): Kunden aus Kunden/cockpit-kunden.json,
 * Ad-Creatives + Checklisten aus <Kundenordner>/05_leadgen/ads.json (via Runner).
 * Bewusst ohne Supabase und ohne Copy-Editor — Copy-Änderungen macht Claude
 * auf den Dateien im Kundenordner.
 */
export function AdsArea() {
  return (
    <Routes>
      <Route index element={<KundenList />} />
      <Route path=":kunde" element={<KundePage />} />
      <Route path=":kunde/:adId" element={<KundePage />} />
    </Routes>
  )
}

function useKunden() {
  const [kunden, setKunden] = useState<Kunde[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetchKunden()
      .then(setKunden)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  return { kunden, error }
}

function KundenList() {
  const navigate = useNavigate()
  const { kunden, error } = useKunden()

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Ads</div>
        <div className="ck-label" style={{ marginTop: 2 }}>
          Ad-Creatives je Kunde — Versionen, Review-Checklisten, Anmerkungen. Quelle: Kundenordner.
        </div>
      </div>

      {error ? (
        <div className="ck-panel" style={{ padding: '10px 14px', border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5 }}>
          Runner nicht erreichbar: {error}
        </div>
      ) : !kunden ? (
        <p className="ck-label">Lade…</p>
      ) : kunden.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Keine Kunden registriert. Lege <code>Kunden/cockpit-kunden.json</code> an — ein Eintrag pro Kunde.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {kunden.map((k) => (
            <button
              key={k.slug}
              className="ck-panel"
              onClick={() => navigate(`/ads/${k.slug}`)}
              style={{
                padding: 14,
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid var(--ck-border)',
                background: 'transparent',
                color: 'inherit',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{k.name}</div>
              <div className="ck-label" style={{ marginTop: 4 }}>
                {k.folder}/{k.adsDir ?? '05_leadgen'}
              </div>
              {k.website?.live ? (
                <div className="ck-label" style={{ marginTop: 2 }}>
                  {k.website.live.replace(/^https?:\/\//, '')}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function KundePage() {
  const navigate = useNavigate()
  const { kunde: slug, adId } = useParams<{ kunde: string; adId?: string }>()
  const { kunden, error: kundenError } = useKunden()
  const kunde = useMemo(() => kunden?.find((k) => k.slug === slug), [kunden, slug])
  const { manifest, loading, error, toggleCheck, addNote, setStatus } = useAdManifest(slug)

  const openAd = manifest?.ads.find((a) => a.id === adId)
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ad of manifest?.ads ?? []) counts.set(ad.status, (counts.get(ad.status) ?? 0) + 1)
    return [...counts.entries()]
  }, [manifest])

  if (kundenError || error) {
    return (
      <div className="ck-panel" style={{ padding: '10px 14px', border: '1px solid var(--ck-warn)', color: 'var(--ck-warn)', fontSize: 12.5, maxWidth: 820 }}>
        {kundenError ?? error}
      </div>
    )
  }
  if (!kunden || loading) return <p className="ck-label">Lade…</p>
  if (!kunde) {
    return (
      <div style={{ maxWidth: 820 }}>
        <p className="ck-label">Unbekannter Kunde: {slug}</p>
        <button className="ck-btn" onClick={() => navigate('/ads')}>← Alle Kunden</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <button className="ck-btn" onClick={() => navigate('/ads')} style={{ marginBottom: 12, fontSize: 12 }}>
        ← Alle Kunden
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{kunde.name}</div>
          <div className="ck-label" style={{ marginTop: 2 }}>
            {manifest?.ads.length ?? 0} Ads
            {statusCounts.map(([s, n]) => ` · ${n} ${AD_STATUS_LABEL[s as keyof typeof AD_STATUS_LABEL] ?? s}`).join('')}
          </div>
        </div>
      </div>

      <WebsiteTile kunde={kunde} />

      {manifest && manifest.overviewFiles.length > 0 ? (
        <div className="ck-panel" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="ck-label" style={{ marginRight: 4 }}>Kampagnen-Seiten:</span>
          {manifest.overviewFiles.map((f) => (
            <a
              key={f.path}
              className="ck-btn"
              style={{ fontSize: 11.5, textDecoration: 'none' }}
              href={kundenFileUrl(kunde, f.path)}
              target="_blank"
              rel="noreferrer"
            >
              {f.label} ↗
            </a>
          ))}
        </div>
      ) : null}

      {!manifest || manifest.ads.length === 0 ? (
        <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
            Noch keine Ads im Manifest ({kunde.adsDir ?? '05_leadgen'}/ads.json).
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {manifest.ads.map((ad) => (
            <AdCard key={ad.id} kunde={kunde} ad={ad} onOpen={() => navigate(`/ads/${kunde.slug}/${ad.id}`)} />
          ))}
        </div>
      )}

      {openAd ? (
        <AdDetailPanel
          kunde={kunde}
          ad={openAd}
          onClose={() => navigate(`/ads/${kunde.slug}`)}
          onToggleCheck={toggleCheck}
          onAddNote={addNote}
          onSetStatus={setStatus}
        />
      ) : null}
    </div>
  )
}

function WebsiteTile({ kunde }: { kunde: Kunde }) {
  const [open, setOpen] = useState(false)
  const site = kunde.website
  if (!site?.live && !site?.dev) return null

  return (
    <div className="ck-panel" style={{ padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Website</span>
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {site.live ? (
            <a className="ck-btn" style={{ fontSize: 11.5, textDecoration: 'none' }} href={site.live} target="_blank" rel="noreferrer">
              Live öffnen ↗
            </a>
          ) : null}
          {site.dev ? (
            <a
              className="ck-btn"
              style={{ fontSize: 11.5, textDecoration: 'none' }}
              href={site.dev}
              target="_blank"
              rel="noreferrer"
              title="Nur erreichbar, wenn der Dev-Server läuft"
            >
              Dev öffnen ↗
            </a>
          ) : null}
          {site.live ? (
            <button className="ck-btn" style={{ fontSize: 11.5 }} onClick={() => setOpen((v) => !v)}>
              {open ? 'Preview zu' : 'Preview'}
            </button>
          ) : null}
        </span>
      </div>
      {open && site.live ? (
        <iframe
          src={site.live}
          title={`${kunde.name} Website`}
          style={{ width: '100%', height: 420, border: '1px solid var(--ck-border)', borderRadius: 8, marginTop: 10, background: '#fff' }}
        />
      ) : null}
    </div>
  )
}
