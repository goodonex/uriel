import { CONTACT_STATUS_OPTIONS, contactStatusMeta, logStatusChange } from '../../lib/crmStatus'
import type { Contact, ContactStatus } from '../../types/db'

export function ContactStatusDropdown({
  contact,
  onField,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
}) {
  const meta = contactStatusMeta(contact.contact_status)

  const setStatus = (next: ContactStatus) => {
    if (next === contact.contact_status) return
    onField({
      contact_status: next,
      activity_log: logStatusChange(contact.activity_log ?? [], contact.contact_status, next),
    })
  }

  return (
    <label className="font-mono flex flex-col gap-1" style={{ minWidth: 200 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
        STATUS
      </span>
      <select
        value={contact.contact_status}
        onChange={(e) => setStatus(e.target.value as ContactStatus)}
        style={{
          fontSize: 13,
          fontWeight: meta.bold ? 700 : 500,
          padding: '10px 12px',
          borderRadius: 10,
          border: `1px solid color-mix(in srgb, ${meta.color} 55%, var(--glass-border-2))`,
          background: `color-mix(in srgb, ${meta.color} 12%, var(--glass-2))`,
          color: meta.color,
          textDecoration: meta.strikethrough ? 'line-through' : 'none',
          cursor: 'pointer',
        }}
      >
        {CONTACT_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
