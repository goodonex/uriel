import type { Contact } from '../../types/db'
import { ContactStatusDropdown } from './ContactStatusDropdown'
import { ContactStageStepper } from './ContactStageStepper'

export function ContactPhaseHeader({
  contact,
  onField,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        width: '100%',
      }}
    >
      <div style={{ flexShrink: 0, paddingTop: 1 }}>
        <ContactStatusDropdown contact={contact} onField={onField} compact />
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <ContactStageStepper
          inline
          fullWidth
          current={contact.pipeline_stage}
          onChange={(s) => onField({ pipeline_stage: s })}
        />
      </div>
    </div>
  )
}
