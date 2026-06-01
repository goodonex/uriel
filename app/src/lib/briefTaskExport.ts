import { companyDisplayName, isPerson, personDisplayName } from './crmContacts'
import type { Contact } from '../types/db'

export type BriefMailingPayload = {
  name: string
  company: string
  website: string
  address: string
}

/** Kontakt + verknüpfte Firma für DirectMailing.ai (flaches JSON). */
export function buildBriefMailingPayload(
  contact: Contact,
  allContacts: Contact[],
): BriefMailingPayload {
  let person = contact
  let company = contact

  if (isPerson(contact) && contact.parent_company_id) {
    const parent = allContacts.find((c) => c.id === contact.parent_company_id)
    if (parent) {
      company = parent
    }
  } else if (contact.contact_type === 'company') {
    company = contact
    const linked = allContacts.find(
      (c) => c.contact_type === 'person' && c.parent_company_id === contact.id,
    )
    if (linked) person = linked
  }

  return {
    name: isPerson(person) ? personDisplayName(person) : personDisplayName(contact),
    company: companyDisplayName(company),
    website: (company.website ?? '').trim(),
    address: (company.address ?? '').trim(),
  }
}

export async function copyBriefMailingJson(
  contact: Contact,
  allContacts: Contact[],
): Promise<void> {
  const payload = buildBriefMailingPayload(contact, allContacts)
  const text = JSON.stringify(payload, null, 2)
  await navigator.clipboard.writeText(text)
}
