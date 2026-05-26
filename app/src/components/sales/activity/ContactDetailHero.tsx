import { isCompany } from '../../../lib/crmContacts'
import type { Contact } from '../../../types/db'
import { ContactChannelButtons } from './ContactChannelButtons'

function initialsOf(name: string): string {
  return (name || 'L')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function ContactDetailHero({
  contact,
  onField,
  embedded = false,
  channelTrailing,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  embedded?: boolean
  channelTrailing?: React.ReactNode
}) {
  const initials = initialsOf(isCompany(contact) ? contact.name || contact.company : contact.name)

  const inner = (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          className="font-display"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background:
              'linear-gradient(135deg, var(--mode-sales), color-mix(in srgb, var(--mode-sales) 50%, var(--accent-teal)))',
            color: '#0e0e10',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={contact.name}
            onChange={(e) => onField({ name: e.target.value })}
            placeholder={isCompany(contact) ? 'Firmenname' : 'Name'}
            className="font-display"
            style={{
              width: '100%',
              fontSize: 22,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              outline: 'none',
              padding: 0,
              letterSpacing: '-0.3px',
            }}
          />
          {!isCompany(contact) && contact.company ? (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {contact.company}
            </div>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <ContactChannelButtons contact={contact} onField={onField} trailing={channelTrailing} />
          </div>
        </div>
      </div>
  )

  if (embedded) return inner

  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      {inner}
    </section>
  )
}
