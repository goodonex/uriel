import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useBrands } from '../../hooks/useBrands'
import { findDeliverProjectInStorage } from '../../lib/deliverProjectCoercion'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../deliver/stageLabels'

const PORTAL_SURFACE = 'rgba(255,255,255,0.03)'
const PORTAL_GLASS =
  'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)'

function parseTeamUpdates(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  const blocks = t.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)
  return blocks.length > 0 ? blocks : [t]
}

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

  const updates = resolved ? parseTeamUpdates(resolved.project.team_notes) : []

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: PORTAL_SURFACE,
        minHeight: '100%',
        margin: '-24px -32px',
        padding: '24px 32px 48px',
        borderRadius: 0,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="glass-2"
        style={{
          borderRadius: 22,
          padding: '32px 28px',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
          background: PORTAL_GLASS,
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        {brandsLoading ? (
          <div
            className="font-mono animate-pulse"
            style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
          >
            Lade…
          </div>
        ) : null}

        {!brandsLoading && !resolved ? (
          <div style={{ textAlign: 'center', padding: '12px 8px 28px' }}>
            <div
              className="font-mono mb-3"
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--accent-teal)',
              }}
            >
              Kundenportal
            </div>
            <h1
              className="font-display"
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.4px',
                marginBottom: 12,
              }}
            >
              Wir finden dieses Projekt gerade nicht
            </h1>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                maxWidth: 420,
                margin: '0 auto',
              }}
            >
              Unter dieser Adresse ist kein aktives Projekt hinterlegt — der Link
              kann abgelaufen sein oder das Projekt wurde noch nicht freigegeben.
              Melde dich bei deinem Ansprechpartner, dann bekommst du einen
              aktuellen Zugang.
            </p>
            {projectId ? (
              <p
                className="font-mono mt-6"
                style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
              >
                Referenz: <span style={{ color: 'var(--text-secondary)' }}>{projectId}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {!brandsLoading && resolved ? (
          <>
            <header className="mb-8">
              <div
                className="font-mono mb-2"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-teal)',
                }}
              >
                {brand?.name ?? resolved.slug}
              </div>
              <h1
                className="font-display"
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.45px',
                  lineHeight: 1.15,
                }}
              >
                {resolved.project.name}
              </h1>
              {displayName ? (
                <p
                  className="mt-3"
                  style={{ fontSize: 14, color: 'var(--text-secondary)' }}
                >
                  Hallo {displayName}
                </p>
              ) : null}
            </header>

            <section className="mb-8">
              <div
                className="font-mono mb-3"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                Fortschritt
              </div>
              <div
                className="flex gap-1.5"
                style={{ width: '100%' }}
                role="list"
                aria-label="Projekt-Stufen"
              >
                {DELIVER_STAGE_ORDER.map((stage, i) => {
                  const done = clientIdx > i
                  const current = clientIdx === i
                  return (
                    <div
                      key={stage}
                      role="listitem"
                      className="flex-1"
                      style={{ minWidth: 0 }}
                    >
                      <div
                        title={DELIVER_STAGE_LABEL[stage]}
                        style={{
                          height: 10,
                          borderRadius: 8,
                          background: done
                            ? 'var(--accent-teal)'
                            : current
                              ? 'color-mix(in srgb, var(--accent-blue) 55%, var(--glass-3))'
                              : 'var(--glass-3)',
                          border: current
                            ? '2px solid var(--accent-blue)'
                            : '1px solid var(--glass-border-2)',
                          boxShadow: current
                            ? '0 0 14px color-mix(in srgb, var(--accent-blue) 35%, transparent)'
                            : undefined,
                        }}
                      />
                      <div
                        className="font-mono mt-2"
                        style={{
                          fontSize: 9,
                          lineHeight: 1.25,
                          color: current
                            ? 'var(--text-primary)'
                            : 'var(--text-tertiary)',
                          textAlign: 'center',
                          wordBreak: 'break-word',
                        }}
                      >
                        {DELIVER_STAGE_LABEL[stage]}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {resolved.project.client_welcome_text.trim() ? (
              <section
                className="mb-8 rounded-2xl p-5"
                style={{
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-2)',
                }}
              >
                <div
                  className="font-mono mb-2"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  Willkommen
                </div>
                <div
                  style={{
                    fontSize: 15,
                    color: 'var(--text-primary)',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {resolved.project.client_welcome_text}
                </div>
              </section>
            ) : null}

            <section className="mb-8">
              <h2
                className="font-display mb-3"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Dokumente &amp; Links
              </h2>
              {resolved.project.client_documents.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  Sobald Materialien freigegeben sind, erscheinen sie hier.
                </p>
              ) : (
                <ul
                  className="flex flex-col gap-2"
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}
                >
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
            </section>

            <section>
              <h2
                className="font-display mb-3"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Updates
              </h2>
              {updates.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  Aktuell keine neuen Hinweise vom Team.
                </p>
              ) : (
                <ul
                  className="flex flex-col gap-3"
                  style={{ listStyle: 'none', padding: 0, margin: 0 }}
                >
                  {updates.map((block, i) => (
                    <li
                      key={i}
                      className="rounded-xl p-4 font-mono"
                      style={{
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: 'var(--text-secondary)',
                        background: 'var(--glass-1)',
                        border: '1px solid var(--glass-border-2)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {block}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </motion.div>
    </div>
  )
}
