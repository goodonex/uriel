import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useMeetingLinks } from '../../hooks/useSalesPro'
import type { SalesMeetingLink } from '../../types/db'
import { useToast } from '../Toast'

interface SalesMeetingLinkDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
}

const DEFAULT_AVAIL = {
  mon: [{ from: '09:00', to: '17:00' }],
  tue: [{ from: '09:00', to: '17:00' }],
  wed: [{ from: '09:00', to: '17:00' }],
  thu: [{ from: '09:00', to: '17:00' }],
  fri: [{ from: '09:00', to: '15:00' }],
}

export function SalesMeetingLinkDrawer({
  open,
  onClose,
  brandSlug,
}: SalesMeetingLinkDrawerProps) {
  const links = useMeetingLinks(brandSlug)
  const { show } = useToast()
  const [draft, setDraft] = useState<Partial<SalesMeetingLink>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (links.items.length > 0 && !selectedId) {
      setSelectedId(links.items[0].id)
    }
  }, [open, links.items, selectedId])

  useEffect(() => {
    if (!open) return
    const m = links.items.find((x) => x.id === selectedId)
    if (m) {
      setDraft(m)
    } else {
      setDraft({
        slug: 'erstgespraech',
        title: 'Erstgespräch',
        description: '',
        duration_minutes: 30,
        buffer_minutes: 15,
        is_active: true,
      })
    }
  }, [selectedId, links.items, open])

  const publicUrl = (slug: string) =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/book/${brandSlug}/${slug}`
      : `/book/${brandSlug}/${slug}`

  const handleSave = async () => {
    if (!draft.slug || !draft.title) {
      show('Slug + Titel sind Pflicht', 'info')
      return
    }
    if (selectedId) {
      await links.update(selectedId, draft)
      show('Meeting-Link aktualisiert', 'success')
    } else {
      const created = await links.create({
        slug: draft.slug,
        title: draft.title,
        description: draft.description ?? '',
        duration_minutes: draft.duration_minutes ?? 30,
        buffer_minutes: draft.buffer_minutes ?? 15,
        is_active: draft.is_active ?? true,
        availability: DEFAULT_AVAIL,
      })
      setSelectedId(created.id)
      show('Meeting-Link angelegt', 'success')
    }
  }

  const copyUrl = (slug: string) => {
    void navigator.clipboard?.writeText(publicUrl(slug)).then(
      () => show('Link kopiert', 'success'),
      () => show('Konnte nicht kopieren', 'error'),
    )
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
          style={{ background: 'var(--overlay-backdrop)', backdropFilter: 'blur(8px)' }}
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
              maxWidth: 560,
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
                  SALES · MEETING-LINK
                </div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
                  Öffentlicher Buchungslink
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

            <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: '1px dashed var(--glass-border-2)',
                    background: selectedId === null ? 'var(--glass-2)' : 'transparent',
                    color: selectedId === null ? 'var(--mode-sales)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  + Neuer Link
                </button>
                {links.items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '5px 10px',
                      borderRadius: 999,
                      border: `1px solid ${
                        selectedId === m.id ? 'var(--mode-sales)' : 'var(--glass-border-2)'
                      }`,
                      background:
                        selectedId === m.id
                          ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
                          : 'transparent',
                      color: selectedId === m.id ? 'var(--mode-sales)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {m.title}
                  </button>
                ))}
              </div>

              <Field label="Titel">
                <input
                  type="text"
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  style={input}
                />
              </Field>
              <Field label="URL-Slug">
                <input
                  type="text"
                  value={draft.slug ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    }))
                  }
                  style={input}
                />
                {draft.slug ? (
                  <div
                    className="font-mono"
                    style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}
                  >
                    {publicUrl(draft.slug)}{' '}
                    <button
                      type="button"
                      onClick={() => copyUrl(draft.slug!)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--mode-sales)',
                        cursor: 'pointer',
                        fontSize: 10,
                      }}
                    >
                      kopieren
                    </button>
                  </div>
                ) : null}
              </Field>
              <Field label="Beschreibung">
                <textarea
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={3}
                  style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Dauer (min)">
                  <input
                    type="number"
                    value={draft.duration_minutes ?? 30}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, duration_minutes: Number(e.target.value) }))
                    }
                    style={input}
                  />
                </Field>
                <Field label="Puffer (min)">
                  <input
                    type="number"
                    value={draft.buffer_minutes ?? 15}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, buffer_minutes: Number(e.target.value) }))
                    }
                    style={input}
                  />
                </Field>
              </div>

              <label
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.is_active ?? true}
                  onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                />
                Aktiv (öffentlich erreichbar)
              </label>
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
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
