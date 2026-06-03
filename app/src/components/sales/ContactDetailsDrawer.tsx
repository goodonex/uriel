import type { Contact, PipelineStage } from '../../types/db'
import { Drawer } from '../Drawer'
import { CONTACT_STATUS_OPTIONS } from '../../lib/crmStatus'
import { LEAD_SOURCE_OPTIONS } from '../../lib/crmLeadSource'

const STAGE_OPTIONS: Array<{ key: PipelineStage; label: string }> = [
  { key: 'first_contact', label: 'Erstkontakt' },
  { key: 'conversation', label: 'Gespräch' },
  { key: 'proposal', label: 'Pitch' },
  { key: 'deal', label: 'Deal' },
  { key: 'paused', label: 'Pause' },
]

const FIELD = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
} as const

export function ContactDetailsDrawer({
  open,
  onClose,
  contact,
  onField,
  onRequestDelete,
}: {
  open: boolean
  onClose: () => void
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  onRequestDelete?: () => void
}) {
  const c = contact

  return (
    <Drawer open={open} onClose={onClose} title="Details" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input
            value={c.name}
            onChange={(e) => onField({ name: e.target.value })}
            style={FIELD}
          />
        </Field>
        <Field label="Firma">
          <input
            value={c.company ?? ''}
            onChange={(e) => onField({ company: e.target.value })}
            style={FIELD}
          />
        </Field>
        <Field label="Job-Titel">
          <input
            value={c.job_title ?? ''}
            onChange={(e) => onField({ job_title: e.target.value })}
            style={FIELD}
          />
        </Field>
        <Field label="Adresse">
          <input
            value={c.address ?? ''}
            onChange={(e) => onField({ address: e.target.value })}
            style={FIELD}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Phase">
            <select
              value={c.pipeline_stage}
              onChange={(e) => onField({ pipeline_stage: e.target.value as PipelineStage })}
              style={FIELD}
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={c.contact_status}
              onChange={(e) =>
                onField({ contact_status: e.target.value as Contact['contact_status'] })
              }
              style={FIELD}
            >
              {CONTACT_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Lead-Quelle">
          <select
            value={c.lead_source ?? ''}
            onChange={(e) =>
              onField({ lead_source: e.target.value as Contact['lead_source'] })
            }
            style={FIELD}
          >
            <option value="">— keine —</option>
            {LEAD_SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Geschätzter Deal-Wert (€)">
          <input
            type="number"
            value={c.lead_value != null ? String(c.lead_value) : ''}
            onChange={(e) =>
              onField({
                lead_value:
                  e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
            style={FIELD}
          />
        </Field>
        <Field label="Call Notes">
          <textarea
            value={c.call_notes ?? ''}
            onChange={(e) => onField({ call_notes: e.target.value })}
            rows={5}
            style={{ ...FIELD, resize: 'vertical' }}
            placeholder="Datum, Themen, Einwände, nächste Schritte…"
          />
        </Field>

        {onRequestDelete ? (
          <div
            style={{
              marginTop: 10,
              paddingTop: 14,
              borderTop: '1px solid var(--glass-border-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                color: 'var(--text-tertiary)',
              }}
            >
              GEFAHRENZONE
            </span>
            <button
              type="button"
              onClick={() => {
                onClose()
                onRequestDelete()
              }}
              className="font-mono"
              style={{
                alignSelf: 'flex-start',
                fontSize: 11,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--accent-coral) 45%, var(--glass-border-2))',
                background: 'transparent',
                color: 'var(--accent-coral)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🗑</span> Lead löschen
            </button>
          </div>
        ) : null}
      </div>
    </Drawer>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        className="font-mono"
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
