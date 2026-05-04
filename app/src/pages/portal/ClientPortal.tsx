import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useBrands } from '../../hooks/useBrands'
import { findDeliverProjectInStorage } from '../../lib/deliverProjectCoercion'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../deliver/stageLabels'

export function ClientPortal() {
  const { projectId } = useParams<{ projectId: string }>()
  const { brands, loading: brandsLoading } = useBrands()
  const { user } = useAuth()

  const slugs = useMemo(() => brands.map((b) => b.slug), [brands])

  const resolved = useMemo(() => {
    if (!projectId) return null
    return findDeliverProjectInStorage(projectId, slugs)
  }, [projectId, slugs])

  const brand = useMemo(() => {
    if (!resolved) return null
    return brands.find((b) => b.slug === resolved.slug) ?? null
  }, [brands, resolved])

  const clientIdx = resolved
    ? DELIVER_STAGE_ORDER.indexOf(resolved.project.client_stage)
    : -1

  const displayName =
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null) ??
    user?.email ??
    ''

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'transparent',
        minHeight: '100%',
        padding: '8px 0 48px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="glass-2"
        style={{
          borderRadius: 20,
          padding: '28px 24px',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
        }}
      >
        {brandsLoading ? (
          <div className="font-mono animate-pulse" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Lade…
          </div>
        ) : null}

        {!brandsLoading && !resolved ? (
          <>
            <div
              className="font-mono mb-2"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--accent-teal)',
              }}
            >
              Kundenportal
            </div>
            <h1
              className="font-display"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
              }}
            >
              Projekt nicht gefunden
            </h1>
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              Unter der ID <span className="font-mono">{projectId}</span> liegt kein Deliver-Projekt in
              localStorage (für deine Brands). Owner legt Projekte im Deliver-Modus an; echte
              Client-Autorisierung folgt später.
            </p>
          </>
        ) : null}

        {!brandsLoading && resolved ? (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#fff',
                  background: brand?.color?.startsWith('var(')
                    ? 'var(--accent-teal)'
                    : (brand?.color ?? 'var(--accent-teal)'),
                  border: '1px solid var(--glass-border-2)',
                }}
              >
                {(brand?.name ?? resolved.slug).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--accent-teal)',
                  }}
                >
                  {brand?.name ?? resolved.slug}
                </div>
                <h1
                  className="font-display mt-1"
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  Kundenportal für {resolved.project.name}
                </h1>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              {displayName ? `Hallo ${displayName} — ` : ''}
              hier siehst du den freigegebenen Stand des Projekts (Placeholder, keine getrennte
              Client-Session).
            </p>

            <div className="mb-6">
              <div className="font-mono mb-3" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Projekt-Status
              </div>
              <div className="flex flex-wrap gap-2">
                {DELIVER_STAGE_ORDER.map((stage, i) => {
                  const done = clientIdx >= i
                  const current = clientIdx === i
                  return (
                    <div
                      key={stage}
                      className="font-mono flex flex-1 flex-col items-center"
                      style={{ minWidth: 72, fontSize: 9 }}
                    >
                      <div
                        style={{
                          height: 6,
                          width: '100%',
                          borderRadius: 999,
                          background: done ? 'var(--accent-teal)' : 'var(--glass-3)',
                          border: current
                            ? '2px solid var(--accent-blue)'
                            : '1px solid var(--glass-border-2)',
                          marginBottom: 6,
                        }}
                      />
                      <span
                        style={{
                          color: current ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          textAlign: 'center',
                          lineHeight: 1.3,
                        }}
                      >
                        {DELIVER_STAGE_LABEL[stage]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {resolved.project.client_welcome_text.trim() ? (
              <div
                className="mb-5 rounded-xl p-4"
                style={{
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-2)',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {resolved.project.client_welcome_text}
              </div>
            ) : (
              <p className="font-mono mb-5" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Noch kein Willkommenstext hinterlegt.
              </p>
            )}

            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Dokumente &amp; Links
            </div>
            {resolved.project.client_documents.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Keine Einträge.</p>
            ) : (
              <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {resolved.project.client_documents.map((d, i) => (
                  <li key={i}>
                    <a
                      href={d.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono"
                      style={{
                        fontSize: 13,
                        color: 'var(--accent-blue)',
                        textDecoration: 'none',
                        borderBottom: '1px solid var(--glass-border-2)',
                      }}
                    >
                      {d.label || d.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </motion.div>
    </div>
  )
}
