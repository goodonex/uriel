import { useEffect, useMemo, useState } from 'react'
import { useEmailTemplates } from '../../hooks/useSalesPro'
import { availableVariables } from '../../lib/emailVariables'
import type { SalesEmailTemplate } from '../../types/db'
import { useToast } from '../Toast'

const FIELD = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
} as const

export function EmailTemplatesPanel({
  brandSlug,
  accent = 'var(--mode-promo)',
}: {
  brandSlug: string
  accent?: string
}) {
  const tpl = useEmailTemplates(brandSlug)
  const { show } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [draft, setDraft] = useState<Partial<SalesEmailTemplate>>({})
  const [batchBusy, setBatchBusy] = useState(false)

  useEffect(() => {
    if (!brandSlug) return
    void tpl.ensureDefaults()
  }, [brandSlug, tpl.ensureDefaults])

  useEffect(() => {
    if (selectedId) {
      const t = tpl.items.find((x) => x.id === selectedId)
      if (t) setDraft({ name: t.name, subject: t.subject, body: t.body, stage: t.stage })
      else setSelectedId(null)
    } else {
      setDraft({ name: '', subject: '', body: '', stage: null })
    }
  }, [selectedId, tpl.items])

  useEffect(() => {
    setCheckedIds((prev) => {
      const valid = new Set(tpl.items.map((t) => t.id))
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [tpl.items])

  const allChecked = tpl.items.length > 0 && checkedIds.size === tpl.items.length
  const someChecked = checkedIds.size > 0

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set())
    else setCheckedIds(new Set(tpl.items.map((t) => t.id)))
  }

  const handleSave = async () => {
    if (!draft.name?.trim()) {
      show('Name ist Pflicht', 'info')
      return
    }
    if (selectedId) {
      await tpl.update(selectedId, draft)
      show('Vorlage gespeichert', 'success')
    } else {
      const created = await tpl.create({
        name: draft.name,
        subject: draft.subject ?? '',
        body: draft.body ?? '',
        stage: draft.stage ?? null,
      })
      setSelectedId(created.id)
      show('Vorlage angelegt', 'success')
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!confirm('Vorlage wirklich löschen?')) return
    try {
      await tpl.remove(selectedId)
      setSelectedId(null)
      show('Vorlage gelöscht', 'info')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error')
    }
  }

  const handleBatchDelete = async () => {
    const ids = [...checkedIds]
    if (ids.length === 0) return
    if (!confirm(`${ids.length} Vorlage(n) wirklich löschen?`)) return
    setBatchBusy(true)
    try {
      await tpl.removeMany(ids)
      if (selectedId && ids.includes(selectedId)) setSelectedId(null)
      setCheckedIds(new Set())
      show(`${ids.length} Vorlage(n) gelöscht`, 'success')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Batch-Löschen fehlgeschlagen', 'error')
    } finally {
      setBatchBusy(false)
    }
  }

  const checkedLabel = useMemo(() => {
    if (!someChecked) return ''
    return `${checkedIds.size} ausgewählt`
  }, [checkedIds.size, someChecked])

  return (
    <div
      className="mt-4 grid gap-4"
      style={{ gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr)' }}
    >
      <aside
        className="glass-2 flex flex-col gap-2 rounded-2xl p-3"
        style={{ border: '1px solid var(--glass-border-1)', alignSelf: 'start' }}
      >
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="font-mono"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 10,
            border: `1px dashed ${selectedId === null ? accent : 'var(--glass-border-2)'}`,
            background:
              selectedId === null
                ? `color-mix(in srgb, ${accent} 12%, transparent)`
                : 'transparent',
            color: selectedId === null ? accent : 'var(--text-secondary)',
            fontSize: 11,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          + Neue Vorlage
        </button>

        {tpl.items.length > 0 ? (
          <div
            className="font-mono flex items-center justify-between gap-2"
            style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '0 2px' }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              Alle
            </label>
            {someChecked ? (
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => void handleBatchDelete()}
                style={{
                  fontSize: 9,
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--accent-coral)',
                  background: 'transparent',
                  color: 'var(--accent-coral)',
                  cursor: batchBusy ? 'wait' : 'pointer',
                }}
              >
                {batchBusy ? '…' : `${checkedIds.size} löschen`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto pr-1">
          {tpl.items.map((t) => {
            const on = t.id === selectedId
            const checked = checkedIds.has(t.id)
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 6,
                  padding: '4px 4px 4px 0',
                  borderRadius: 10,
                  border: `1px solid ${on ? accent : checked ? 'color-mix(in srgb, var(--accent-coral) 35%, var(--glass-border-2))' : 'transparent'}`,
                  background: on ? 'var(--glass-3)' : checked ? 'color-mix(in srgb, var(--accent-coral) 6%, transparent)' : 'transparent',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 6,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(t.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className="text-left font-mono"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 8px 6px 0',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  {t.subject ? (
                    <div style={{ color: 'var(--text-tertiary)', marginTop: 4, fontSize: 9 }}>
                      {t.subject.slice(0, 48)}
                      {t.subject.length > 48 ? '…' : ''}
                    </div>
                  ) : null}
                </button>
              </div>
            )
          })}
        </div>

        {checkedLabel ? (
          <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            {checkedLabel}
          </div>
        ) : null}
      </aside>

      <div
        className="glass-2 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)' }}
      >
        <Field label="Name">
          <input
            value={draft.name ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="z. B. Erstkontakt Makler"
            style={FIELD}
          />
        </Field>
        <Field label="Betreff">
          <input
            value={draft.subject ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            placeholder="Hallo {{first_name}} …"
            style={FIELD}
          />
        </Field>
        <Field label="Nachricht">
          <textarea
            value={draft.body ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={12}
            placeholder={'Hi {{first_name}},\n\n…'}
            style={{ ...FIELD, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', width: '100%' }}>
            VARIABLEN
          </span>
          {availableVariables().map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, body: `${d.body ?? ''}{{${v.key}}}` }))}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          {selectedId ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="font-mono"
              style={{
                fontSize: 11,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--accent-coral)',
                background: 'transparent',
                color: 'var(--accent-coral)',
                cursor: 'pointer',
              }}
            >
              Löschen
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '8px 14px',
              borderRadius: 8,
              border: `1px solid ${accent}`,
              background: `color-mix(in srgb, ${accent} 18%, transparent)`,
              color: accent,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {selectedId ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span
        className="font-mono"
        style={{
          display: 'block',
          fontSize: 9,
          letterSpacing: '0.1em',
          color: 'var(--text-tertiary)',
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  )
}
