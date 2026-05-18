import type { Contact, ContactType } from '../types/db'

export function isCompany(c: Pick<Contact, 'contact_type'>): boolean {
  return (c.contact_type ?? 'company') === 'company'
}

export function isPerson(c: Pick<Contact, 'contact_type'>): boolean {
  return c.contact_type === 'person'
}

export function personDisplayName(c: Contact): string {
  const fn = (c.first_name ?? '').trim()
  const ln = (c.last_name ?? '').trim()
  const combined = `${fn} ${ln}`.trim()
  if (combined) return combined
  return (c.name ?? '').trim() || 'Ansprechpartner'
}

export function companyDisplayName(c: Contact): string {
  return (c.name ?? '').trim() || (c.company ?? '').trim() || 'Firma'
}

export function contactDisplayName(c: Contact): string {
  return isPerson(c) ? personDisplayName(c) : companyDisplayName(c)
}

export function personsForCompany(contacts: Contact[], companyId: string): Contact[] {
  return contacts.filter(
    (c) => c.contact_type === 'person' && c.parent_company_id === companyId,
  )
}

export function primaryPerson(contacts: Contact[], companyId: string): Contact | null {
  const ps = personsForCompany(contacts, companyId)
  return ps[0] ?? null
}

export function buildPersonName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim()
}

export function normalizeContactType(raw: unknown): ContactType {
  return raw === 'person' ? 'person' : 'company'
}
