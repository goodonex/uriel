import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useEmailTemplates } from '../../hooks/useSalesPro'
import type { SalesEmailTemplate } from '../../types/db'
import { availableVariables } from '../../lib/emailVariables'
import { useToast } from '../Toast'

interface EmailTemplatesDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
}

export function EmailTemplatesDrawer({ open, onClose, brandSlug }: EmailTemplatesDrawerProps) {
  const tpl = useEmailTemplates(brandSlug)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<SalesEmailTemplate>>({})
  const { show } = useToast()

  useEffect(() => {
    if (!open) return
    if (selectedId) {
      const t = tpl.items.find((x) => x.id === selectedId)
      if (t) setDraft({ name: t.name, subject: t.subject, body: t.body, stage: t.stage })
    } else {
      setDraft({ name: '', subject: '', body: '', stage: null })
    }
  }, [open, selectedId, tpl.items])

  const handleSave = async () => {
    if (!draft.name?.trim()) {
      show('Name ist Pflicht', 'info')
      return
    }
    if (selectedId) {
      await tpl.update(selectedId, draft)
      show('Template aktualisiert', 'success')
    } else {
      const created = await tpl.create({
        name: draft.name,
        subject: draft.subject ?? '',
        body: draft.body ?? '',
        stage: draft.stage ?? null,
      })
      setSelectedId(created.id)
      show('Template angelegt', 'success')
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!confirm('Template wirklich löschen?')) return
    try {
      await tpl.remove(selectedId)
      setSelectedId(null)
      show('Template gelöscht', 'info')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error')
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
          style={{
            background: 'var(--overlay-backdrop)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.aside
            initial={{ x: 540 }}
            animate={{ x: 0 }}
            exit={{ x: 540 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="font-body"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 700,
              background: 'var(--surface-drawer)',
              borderLeft: '1px solid var(--glass-border-2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
                >
                  SALES · MAIL-TEMPLATES
                </div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
                  Wiederverwendbare Texte
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--glass-border-2)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                Esc
              </button>
            </header>

            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <aside
                style={{
                  width: 220,
                  borderRight: '1px solid var(--glass-border-1)',
                  overflowY: 'auto',
                  padding: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="font-mono"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: 8,
                    borderRadius: 8,
                    border: `1px dashed ${
                      selectedId === null ? 'var(--mode-sales)' : 'var(--glass-border-2)'
                    }`,
                    background:
                      selectedId === null
                        ? 'color-mix(in srgb, var(--mode-sales) 12%, transparent)'
                        : 'transparent',
                    color: selectedId === null ? 'var(--mode-sales)' : 'var(--text-secondary)',
                    fontSize: 11,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  + Neues Template
                </button>
                <ul className="list-none p-0" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {tpl.items.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: 7,
                          border: `1px solid ${
                            selectedId === t.id ? 'var(--mode-sales)' : 'transparent'
                          }`,
                          background:
                            selectedId === t.id
                              ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
                              : 'var(--glass-1)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        {t.stage ? (
                          <div
                            className="font-mono"
                            style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                          >
                            Stage: {t.stage}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>

              <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                <Field label="Name">
                  <input
                    type="text"
                    value={draft.name ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="z. B. Erstkontakt Makler"
                    style={input}
                  />
                </Field>
                <Field label="Stage (optional)">
                  <input
                    type="text"
                    value={draft.stage ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value || null }))}
                    placeholder="first_contact / conversation / proposal …"
                    style={input}
                  />
                </Field>
                <Field label="Betreff">
                  <input
                    type="text"
                    value={draft.subject ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                    placeholder={'Hallo {{first_name}} …'}
                    style={input}
                  />
                </Field>
                <Field label="Body">
                  <textarea
                    value={draft.body ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    rows={14}
                    placeholder={'Hi {{first_name}},\n\n…'}
                    style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </Field>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginTop: 4,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--glass-border-1)',
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      alignSelf: 'center',
                      marginRight: 6,
                    }}
                  >
                    Variablen:
                  </span>
                  {availableVariables().map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, body: `${d.body ?? ''}{{${v.key}}}` }))
                      }
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        padding: '3px 7px',
                        borderRadius: 999,
                        border: '1px solid var(--glass-border-2)',
                        background: 'var(--glass-1)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                {selectedId ? (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--accent-coral)',
                      background: 'transparent',
                      color: 'var(--accent-coral)',
                      cursor: 'pointer',
                    }}
                  >
                    Löschen
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
                  color: 'var(--mode-sales)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {selectedId ? 'Speichern' : 'Anlegen'}
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  )
}
