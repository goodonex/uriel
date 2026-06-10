import { useState } from 'react'
import { buildPersonName, isCompany, personDisplayName, personsForCompany } from '../../lib/crmContacts'
import { useContacts } from '../../hooks/useContacts'
import type { Contact } from '../../types/db'

const FIELD = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  fontSize: 12,
} as const

export function CompanyPersonSection({
  brandSlug,
  company,
  onField,
}: {
  brandSlug: string
  company: Contact
  onField?: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
}) {
  const contacts = useContacts(brandSlug)
  const people = personsForCompany(contacts.items, company.id)
  const [adding, setAdding] = useState(false)
  const [fn, setFn] = useState('')
  const [ln, setLn] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftEmail, setDraftEmail] = useState('')
  const [draftPhone, setDraftPhone] = useState('')
  const [draftTitle, setDraftTitle] = useState('')

  if (!isCompany(company)) return null

  const addPerson = async () => {
    const name = buildPersonName(fn, ln)
    const r = await contacts.create(
      {
        contact_type: 'person',
        parent_company_id: company.id,
        first_name: fn.trim(),
        last_name: ln.trim(),
        name: name || 'Ansprechpartner',
        email: email.trim(),
        phone: phone.trim(),
        job_title: title.trim(),
        pipeline_stage: company.pipeline_stage,
        contact_status: company.contact_status,
      },
      { skipDuplicateCheck: true },
    )
    if (r.ok) {
      setAdding(false)
      setFn('')
      setLn('')
      setEmail('')
      setPhone('')
      setTitle('')
    }
  }

  const savePerson = async (personId: string) => {
    const person = people.find((p) => p.id === personId)
    if (!person) return
    const fullName = draftName.trim()
    const [firstName = '', ...rest] = fullName.split(/\s+/)
    const lastName = rest.join(' ')
    contacts.update(personId, {
      name: fullName || person.name,
      first_name: firstName,
      last_name: lastName,
      email: draftEmail.trim(),
      phone: draftPhone.trim(),
      job_title: draftTitle.trim(),
    })
    if (personId === people[0]?.id) {
      onField?.({
        ansprechpartner: fullName || personDisplayName(person),
      })
    }
    setEditingId(null)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="font-mono mb-2" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
        ANSPRECHPARTNER
      </div>
      <div className="flex flex-col gap-2">
        {people.map((p, idx) => (
          <div
            key={p.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
          >
            <div
              className="rounded-lg px-3 py-2"
              style={{
                flex: 1,
                minWidth: 0,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
              }}
            >
              {editingId === p.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="Name"
                    style={FIELD}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void savePerson(p.id)
                    }}
                  />
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Position"
                    style={FIELD}
                    onBlur={() => void savePerson(p.id)}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      placeholder="E-Mail"
                      style={FIELD}
                      onBlur={() => void savePerson(p.id)}
                    />
                    <input
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      placeholder="Telefon"
                      style={FIELD}
                      onBlur={() => void savePerson(p.id)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id)
                      setDraftName(personDisplayName(p))
                      setDraftEmail(p.email ?? '')
                      setDraftPhone(p.phone ?? '')
                      setDraftTitle(p.job_title ?? '')
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      padding: 0,
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'text',
                    }}
                  >
                    {personDisplayName(p)}
                  </button>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {[p.job_title, p.email, p.phone].filter(Boolean).join(' · ') || '—'}
                  </div>
                </>
              )}
            </div>
            {idx === 0 && !adding ? (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="font-mono"
                style={{
                  ...btn,
                  flexShrink: 0,
                  fontSize: 10,
                  padding: '4px 10px',
                  marginTop: 6,
                }}
              >
                + AP
              </button>
            ) : null}
          </div>
        ))}
        {people.length === 0 && !adding ? (
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>
            Noch kein Ansprechpartner.
          </p>
        ) : null}
      </div>
      {adding ? (
        <div className="mt-2 flex flex-col gap-2">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <input value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Vorname" style={FIELD} />
            <input value={ln} onChange={(e) => setLn(e.target.value)} placeholder="Nachname" style={FIELD} />
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" style={FIELD} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" style={FIELD} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Position" style={FIELD} />
          <div className="flex gap-2">
            <button type="button" onClick={() => void addPerson()} className="font-mono" style={{ fontSize: 11, ...btn }}>
              Speichern
            </button>
            <button type="button" onClick={() => setAdding(false)} className="font-mono" style={{ fontSize: 11, ...btnGhost }}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : people.length === 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="font-mono mt-2"
          style={{ ...btn, fontSize: 11 }}
        >
          + Ansprechpartner hinzufügen
        </button>
      ) : null}
    </div>
  )
}

const btn = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--mode-sales)',
  color: 'var(--mode-sales)',
  background: 'transparent',
  cursor: 'pointer',
} as const

const btnGhost = { ...btn, border: '1px solid var(--glass-border-2)', color: 'var(--text-secondary)' } as const
