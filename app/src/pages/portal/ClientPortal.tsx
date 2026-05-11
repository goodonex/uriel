import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { usePortalProject } from '../../hooks/usePortalProject'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../deliver/stageLabels'

function StageProgressBar({ activeIdx }: { activeIdx: number }) {
  return (
    <div className="flex gap-1.5" role="list" aria-label="Projekt-Stufen">
      {DELIVER_STAGE_ORDER.map((stage, i) => {
        const done = activeIdx >= 0 && activeIdx > i
        const current = activeIdx >= 0 && activeIdx === i
        return (
          <div key={stage} role="listitem" className="min-w-0 flex-1">
            <div
              title={DELIVER_STAGE_LABEL[stage]}
              style={{
                height: 10,
                borderRadius: 8,
                background: done
                  ? 'var(--accent-teal)'
                  : current
                    ? 'color-mix(in srgb, var(--accent-teal) 45%, var(--glass-3))'
                    : 'var(--glass-3)',
                border: current
                  ? '2px solid var(--accent-teal)'
                  : '1px solid var(--glass-border-2)',
                boxShadow: current
                  ? '0 0 16px color-mix(in srgb, var(--accent-teal) 40%, transparent)'
                  : undefined,
              }}
            />
            <div
              className="font-mono mt-2"
              style={{
                fontSize: 9,
                lineHeight: 1.25,
                color: current ? 'var(--text-primary)' : 'var(--text-tertiary)',
                textAlign: 'center',
              }}
            >
              {DELIVER_STAGE_LABEL[stage]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusTimeline({ activeIdx }: { activeIdx: number }) {
  return (
    <div className="flex flex-col gap-3">
      {DELIVER_STAGE_ORDER.map((stage, i) => {
        const done = activeIdx >= 0 && activeIdx > i
        const current = activeIdx >= 0 && activeIdx === i
        return (
          <div key={stage} className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                border: current
                  ? '2px solid var(--accent-teal)'
                  : '1px solid var(--glass-border-2)',
                background: done
                  ? 'var(--accent-teal)'
                  : current
                    ? 'color-mix(in srgb, var(--accent-teal) 25%, transparent)'
                    : 'var(--glass-1)',
                color: done ? '#080810' : 'var(--text-secondary)',
              }}
            >
              {done ? '✓' : i + 1}
            </div>
            <div>
              <div
                className="font-display"
                style={{
                  fontSize: 14,
                  fontWeight: current ? 600 : 500,
                  color: current ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {DELIVER_STAGE_LABEL[stage]}
              </div>
              {current ? (
                <div className="font-mono mt-1" style={{ fontSize: 10, color: 'var(--accent-teal)' }}>
                  Aktuelle Phase
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ClientPortal({ preview = false }: { preview?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>()
  const { user, role, clientProjectId, signOut } = useAuth()
  const navigate = useNavigate()

  const { project, brand, loading, error } = usePortalProject(projectId, {
    preview,
    role,
    clientProjectId,
    userId: user?.id ?? null,
  })

  const rawIdx = project ? DELIVER_STAGE_ORDER.indexOf(project.client_stage) : -1
  const currentLabel =
    project && rawIdx >= 0 ? DELIVER_STAGE_LABEL[project.client_stage] : '—'

  const displayName =
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null) ??
    user?.email ??
    ''

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'var(--bg-base)',
        minHeight: '100%',
        margin: '-24px -16px',
        padding: '24px 16px 48px',
      }}
      className="md:-mx-8"
    >
      <div className="relative mx-auto max-w-[640px]">
        {!preview ? (
          <div className="absolute right-0 top-0 z-10">
            <button
              type="button"
              className="font-mono"
              onClick={() => void handleLogout()}
              style={{
                fontSize: 11,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-3)',
                color: 'var(--text-secondary)',
              }}
            >
              Abmelden
            </button>
          </div>
        ) : (
          <div
            className="absolute right-0 top-0 z-10 font-mono"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Vorschau
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ paddingTop: 8 }}
        >
          {loading ? (
            <div
              className="font-mono animate-pulse"
              style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
            >
              Projekt wird geladen…
            </div>
          ) : null}

          {error ? (
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--accent-coral)' }}>
              {error}
            </p>
          ) : null}

          {!loading && !error && !project ? (
            <div style={{ textAlign: 'center', padding: '32px 8px' }}>
              <h1
                className="font-display"
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 12,
                }}
              >
                Projekt nicht gefunden
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Unter dieser Adresse liegt kein sichtbares Projekt. Bitte prüfe den Link oder
                wende dich an deinen Ansprechpartner.
              </p>
            </div>
          ) : null}

          {!loading && project ? (
            <>
              <header
                className="mb-8 pr-24"
                style={{ paddingRight: preview ? 72 : undefined }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display"
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#fff',
                      background: brand?.color?.startsWith('var(')
                        ? 'var(--accent-teal)'
                        : (brand?.color ?? 'var(--accent-teal)'),
                      border: '1px solid var(--glass-border-2)',
                    }}
                  >
                    {(brand?.name ?? '?').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-mono truncate"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--accent-teal)',
                      }}
                    >
                      {brand?.name ?? 'Marke'}
                    </div>
                    <h1
                      className="font-display truncate"
                      style={{
                        fontSize: 26,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.4px',
                      }}
                    >
                      {project.name}
                    </h1>
                  </div>
                </div>

                {displayName && !preview ? (
                  <p className="mb-4" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    Hallo {displayName}
                  </p>
                ) : null}

                <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Fortschritt
                </div>
                <StageProgressBar activeIdx={rawIdx} />
              </header>

              <section
                className="glass-3 mb-6 rounded-2xl p-5"
                style={{
                  border: '1px solid var(--glass-border-2)',
                  backdropFilter: 'var(--blur-md)',
                  WebkitBackdropFilter: 'var(--blur-md)',
                }}
              >
                <h2
                  className="font-display mb-3"
                  style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  Willkommen
                </h2>
                {project.client_welcome_text.trim() ? (
                  <p
                    style={{
                      fontSize: 15,
                      color: 'var(--text-primary)',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {project.client_welcome_text}
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    Dein Team hat hier noch keinen Willkommenstext hinterlegt.
                  </p>
                )}
              </section>

              <section
                className="glass-3 mb-6 rounded-2xl p-5"
                style={{
                  border: '1px solid var(--glass-border-2)',
                  backdropFilter: 'var(--blur-md)',
                  WebkitBackdropFilter: 'var(--blur-md)',
                }}
              >
                <h2
                  className="font-display mb-4"
                  style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  Dein Projektstatus
                </h2>
                <div
                  className="font-display mb-6"
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: 'var(--accent-teal)',
                    letterSpacing: '-0.5px',
                  }}
                >
                  {currentLabel}
                </div>
                <StatusTimeline activeIdx={rawIdx} />
              </section>

              <section
                className="glass-3 mb-6 rounded-2xl p-5"
                style={{
                  border: '1px solid var(--glass-border-2)',
                  backdropFilter: 'var(--blur-md)',
                  WebkitBackdropFilter: 'var(--blur-md)',
                }}
              >
                <h2
                  className="font-display mb-3"
                  style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  Was ist fertig?
                </h2>
                {project.deliverables.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    Sobald dein Team Deliverables definiert, siehst du den Status hier.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {project.deliverables.map((d, i) => (
                      <li
                        key={`${d.title}-${i}`}
                        className="flex items-start gap-3 rounded-xl px-3 py-2"
                        style={{ border: '1px solid var(--glass-border-2)' }}
                      >
                        <span className="mt-0.5 font-mono" style={{ fontSize: 14 }}>
                          {d.status === 'fertig' ? (
                            <span style={{ color: '#22c55e' }}>✓</span>
                          ) : d.status === 'in_arbeit' ? (
                            <span style={{ color: '#f97316' }}>⟳</span>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>○</span>
                          )}
                        </span>
                        <div>
                          <div className="font-display" style={{ fontSize: 14, fontWeight: 500 }}>
                            {d.title}
                          </div>
                          <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                            {d.status === 'fertig'
                              ? 'Fertig'
                              : d.status === 'in_arbeit'
                                ? 'In Arbeit'
                                : 'Geplant'}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {project.booking_url.trim() ? (
                <section
                  className="glass-3 mb-6 rounded-2xl p-5"
                  style={{
                    border: '1px solid var(--glass-border-2)',
                    backdropFilter: 'var(--blur-md)',
                    WebkitBackdropFilter: 'var(--blur-md)',
                  }}
                >
                  <h2
                    className="font-display mb-3"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    Termin buchen
                  </h2>
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => window.open(project.booking_url, '_blank', 'noopener,noreferrer')}
                    style={{
                      fontSize: 12,
                      padding: '12px 18px',
                      borderRadius: 12,
                      border: '1px solid var(--accent-teal)',
                      background: 'color-mix(in srgb, var(--accent-teal) 16%, transparent)',
                      color: 'var(--accent-teal)',
                      cursor: 'pointer',
                    }}
                  >
                    Termin buchen
                  </button>
                </section>
              ) : null}

              <section>
                <h2
                  className="font-display mb-4"
                  style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  Dokumente &amp; Links
                </h2>
                {project.client_documents.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                    Sobald Dokumente freigegeben sind, erscheinen sie hier.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {project.client_documents.map((d, i) => (
                      <li
                        key={i}
                        className="glass-3 rounded-xl p-4"
                        style={{
                          border: '1px solid var(--glass-border-2)',
                          backdropFilter: 'var(--blur-md)',
                          WebkitBackdropFilter: 'var(--blur-md)',
                        }}
                      >
                        <a
                          href={d.url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="font-display"
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: 'var(--accent-blue)',
                            textDecoration: 'none',
                          }}
                        >
                          {d.label || d.url}
                        </a>
                        {d.description ? (
                          <p
                            className="mt-2"
                            style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}
                          >
                            {d.description}
                          </p>
                        ) : null}
                        <p className="font-mono mt-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {d.url}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </motion.div>
      </div>
    </div>
  )
}
