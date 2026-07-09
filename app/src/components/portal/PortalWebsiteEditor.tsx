import { useRef, useState } from 'react'
import { useSiteContent } from '../../hooks/useSiteContent'
import type { SiteContentField } from '../../hooks/useSiteContent'
import { supabase } from '../../lib/supabase'

/**
 * Website-CMS im Kundenportal: feste Text-/Bild-Felder (von Kevin definiert),
 * Kunde speichert Entwürfe → Status „Wartet auf Freigabe" → Kevin gibt frei.
 * Bilder gehen in den öffentlichen Bucket `site-assets` (Wert = URL).
 */

function StatusChip({ status }: { status: SiteContentField['status'] }) {
  const pending = status === 'pending'
  return (
    <span
      style={{
        fontSize: 10.5,
        padding: '2px 8px',
        borderRadius: 99,
        background: pending ? '#fef3c7' : '#dcfce7',
        color: pending ? '#92400e' : '#166534',
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? 'Wartet auf Freigabe' : 'Live'}
    </span>
  )
}

function ImageField({
  field,
  projectId,
  onSave,
}: {
  field: SiteContentField
  projectId: string
  onSave: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const current = field.value_draft ?? field.value_published

  const upload = async (file: File) => {
    if (!supabase) return
    setBusy(true)
    setErr(null)
    try {
      const path = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`
      const { error } = await supabase.storage.from('site-assets').upload(path, file)
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
      onSave(data.publicUrl)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {current ? (
        <img
          src={current}
          alt={field.label}
          style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--portal-border)' }}
        />
      ) : (
        <div
          style={{
            width: 72,
            height: 48,
            borderRadius: 8,
            border: '1px dashed var(--portal-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: 'var(--portal-text-tertiary)',
          }}
        >
          Kein Bild
        </div>
      )}
      <button type="button" className="portal-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? 'Lädt…' : 'Bild ersetzen'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void upload(f)
          e.target.value = ''
        }}
      />
      {err ? <span style={{ fontSize: 11, color: '#c0392b' }}>{err}</span> : null}
    </div>
  )
}

export function PortalWebsiteEditor({ projectId }: { projectId: string }) {
  const { sections, loading, error, saveDraft } = useSiteContent(projectId)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})

  if (loading) return null
  if (sections.length === 0) {
    // Noch keine Felder definiert → Bereich für den Kunden unsichtbar lassen
    return null
  }

  const valueOf = (f: SiteContentField) => drafts[f.id] ?? f.value_draft ?? f.value_published ?? ''
  const isDirty = (f: SiteContentField) => drafts[f.id] != null && drafts[f.id] !== (f.value_draft ?? f.value_published ?? '')

  const save = (f: SiteContentField) => {
    void saveDraft(f.id, valueOf(f))
    setSavedAt((cur) => ({ ...cur, [f.id]: Date.now() }))
    setDrafts(({ [f.id]: _saved, ...rest }) => rest)
  }

  const inputStyle = {
    width: '100%',
    padding: '9px 11px',
    borderRadius: 9,
    border: '1px solid var(--portal-border)',
    fontSize: 13.5,
    color: 'var(--portal-text)',
    background: '#fff',
  } as const

  return (
    <div className="portal-card" style={{ marginTop: 16 }}>
      <h3 className="portal-section-title">Deine Website-Inhalte</h3>
      <p className="portal-section-meta">
        Texte und Bilder hier anpassen — Änderungen gehen nach kurzer Prüfung durch uns live.
      </p>

      {error ? <p style={{ fontSize: 12, color: '#c0392b' }}>{error}</p> : null}

      {sections.map(({ section, fields }) => (
        <div key={section} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--portal-text-secondary)',
              margin: '0 0 8px',
            }}
          >
            {section}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map((f) => (
              <div key={f.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <label style={{ fontSize: 12.5, fontWeight: 500 }}>{f.label}</label>
                  <StatusChip status={f.status} />
                </div>

                {f.field_type === 'image' ? (
                  <ImageField field={f} projectId={projectId} onSave={(url) => void saveDraft(f.id, url)} />
                ) : (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {f.field_type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={valueOf(f)}
                        onChange={(e) => setDrafts((c) => ({ ...c, [f.id]: e.target.value }))}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={valueOf(f)}
                        onChange={(e) => setDrafts((c) => ({ ...c, [f.id]: e.target.value }))}
                        style={inputStyle}
                      />
                    )}
                    <button
                      type="button"
                      className="portal-btn"
                      disabled={!isDirty(f)}
                      onClick={() => save(f)}
                      style={{ opacity: isDirty(f) ? 1 : 0.45, flexShrink: 0 }}
                    >
                      {savedAt[f.id] && !isDirty(f) ? 'Gespeichert ✓' : 'Speichern'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
