import { useRef, useState } from 'react'
import { alsSchalter, istAn, useSiteContent } from '../../hooks/useSiteContent'
import type { SiteContentField } from '../../hooks/useSiteContent'
import { supabase } from '../../lib/supabase'

/**
 * Website-CMS im Kundenportal: feste Text-/Bild-/Schalter-Felder (von Kevin
 * definiert), der Kunde füllt sie.
 *
 * Zwei Betriebsarten, die das Projekt vorgibt (0084):
 *   autopublish = false → Entwurf, Status „Wartet auf Freigabe", Kevin gibt frei.
 *   autopublish = true  → gespeichert ist live, Kevin kommt nicht vor.
 *
 * Bilder gehen in den öffentlichen Bucket `site-assets` (Wert = URL).
 */

function StatusChip({
  status,
  autopublish,
}: {
  status: SiteContentField['status']
  autopublish: boolean
}) {
  // Bei Autopublish gibt es kein Wartezimmer: gespeichert ist live.
  const pending = !autopublish && status === 'pending'
  return (
    <span
      style={{
        fontSize: 10.5,
        padding: '2px 8px',
        borderRadius: 99,
        background: pending ? 'var(--status-warn-bg)' : 'var(--status-success-bg)',
        color: pending ? 'var(--accent-amber)' : 'var(--accent-success)',
        whiteSpace: 'nowrap',
      }}
    >
      {pending ? 'Wartet auf Freigabe' : 'Live'}
    </span>
  )
}

/** Schalter-Feld: kein „Speichern"-Knopf, das Umlegen IST das Speichern. */
function SchalterField({
  field,
  value,
  onSave,
}: {
  field: SiteContentField
  value: string
  onSave: (value: string) => void
}) {
  const an = istAn(value)
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={an}
        onChange={(e) => onSave(alsSchalter(e.target.checked))}
        style={{ width: 17, height: 17, accentColor: 'var(--portal-accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 13, color: an ? 'var(--portal-text)' : 'var(--portal-text-tertiary)' }}>
        {an ? 'Eingeschaltet — auf der Website sichtbar' : 'Ausgeschaltet — nicht auf der Website'}
      </span>
      <span className="sr-only">{field.label}</span>
    </label>
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
      {err ? <span style={{ fontSize: 11, color: 'var(--status-danger)' }}>{err}</span> : null}
    </div>
  )
}

export function PortalWebsiteEditor({
  projectId,
  autopublish = false,
  liveUrl,
}: {
  projectId: string
  /** deliver_projects.cms_autopublish — Speichern ist live, keine Freigabe. */
  autopublish?: boolean
  /** Für den „ansehen"-Link direkt neben der Überschrift. */
  liveUrl?: string
}) {
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
    background: 'var(--portal-surface)',
  } as const

  return (
    <div className="portal-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h3 className="portal-section-title">Deine Website-Inhalte</h3>
        {liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: 'var(--portal-accent)', whiteSpace: 'nowrap' }}
          >
            Website ansehen ↗
          </a>
        ) : null}
      </div>
      <p className="portal-section-meta">
        {autopublish
          ? 'Texte, Bilder und Schalter hier anpassen. Gespeichert heißt live — nach dem Neuladen der Website steht der neue Stand da.'
          : 'Texte und Bilder hier anpassen — Änderungen gehen nach kurzer Prüfung durch uns live.'}
      </p>

      {error ? <p style={{ fontSize: 12, color: 'var(--status-danger)' }}>{error}</p> : null}

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
                  <StatusChip status={f.status} autopublish={autopublish} />
                </div>

                {f.field_type === 'image' ? (
                  <ImageField field={f} projectId={projectId} onSave={(url) => void saveDraft(f.id, url)} />
                ) : f.field_type === 'boolean' ? (
                  <SchalterField
                    field={f}
                    value={valueOf(f)}
                    onSave={(v) => {
                      setDrafts((c) => ({ ...c, [f.id]: v }))
                      void saveDraft(f.id, v)
                      setSavedAt((cur) => ({ ...cur, [f.id]: Date.now() }))
                    }}
                  />
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
                        type={f.field_type === 'url' ? 'url' : 'text'}
                        inputMode={f.field_type === 'url' ? 'url' : undefined}
                        placeholder={f.field_type === 'url' ? 'https://…' : undefined}
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
