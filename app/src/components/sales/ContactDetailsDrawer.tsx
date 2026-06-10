import type { Contact } from '../../types/db'
import { Drawer } from '../Drawer'
import { LEAD_SOURCE_OPTIONS } from '../../lib/crmLeadSource'

const FIELD = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'color-mix(in srgb, var(--bg-base) 92%, var(--glass-2))',
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
        <Field label="Adresse">
          <input
            value={c.address ?? ''}
            onChange={(e) => onField({ address: e.target.value })}
            style={FIELD}
          />
        </Field>

        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--text-tertiary)',
            paddingTop: 4,
          }}
        >
          KONTAKTDATEN
        </div>

        <Field label="Telefon">
          <input
            value={c.phone ?? ''}
            onChange={(e) => onField({ phone: e.target.value })}
            placeholder="+49 …"
            style={FIELD}
          />
        </Field>
        <Field label="E-Mail">
          <input
            type="email"
            value={c.email ?? ''}
            onChange={(e) => onField({ email: e.target.value })}
            placeholder="name@firma.de"
            style={FIELD}
          />
        </Field>
        <Field label="Website">
          <input
            value={c.website ?? ''}
            onChange={(e) => onField({ website: e.target.value })}
            placeholder="https://…"
            style={FIELD}
          />
        </Field>
        <Field label="LinkedIn">
          <input
            value={c.linkedin ?? ''}
            onChange={(e) => onField({ linkedin: e.target.value })}
            placeholder="linkedin.com/in/…"
            style={FIELD}
          />
        </Field>
        <Field label="Instagram">
          <input
            value={c.instagram ?? ''}
            onChange={(e) => onField({ instagram: e.target.value })}
            placeholder="@handle"
            style={FIELD}
          />
        </Field>

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
