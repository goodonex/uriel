import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buildPersonName, companyDisplayName } from '../../lib/crmContacts'
import { LEAD_SOURCE_OPTIONS } from '../../lib/crmLeadSource'
import { findDuplicateInContacts } from '../../hooks/useContacts'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { similarityPercent } from '../../lib/levenshtein'
import type { Contact, LeadSource } from '../../types/db'

const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
  boxSizing: 'border-box' as const,
}

const btnPrimary = {
  fontSize: 12,
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid var(--mode-sales)',
  background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
  color: 'var(--mode-sales)',
  cursor: 'pointer',
  fontWeight: 600,
} as const

const btnGhost = {
  fontSize: 12,
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
} as const

export function NewLeadWizardModal({
  open,
  onClose,
  onSubmit,
  existingContacts = [],
}: {
  open: boolean
  onClose: () => void
  existingContacts?: Contact[]
  onSubmit: (payload: {
    company: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>
    person: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>
  }, options?: { skipDuplicateCheck?: boolean }) => void | Promise<void>
}) {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [personPhone, setPersonPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [note, setNote] = useState('')
  const [leadSource, setLeadSource] = useState<LeadSource>('')
  const [fuzzyMatch, setFuzzyMatch] = useState<Contact | null>(null)
  const [forceCreate, setForceCreate] = useState(false)

  const emailDup = useMemo(() => {
    const em = email.trim().toLowerCase()
    if (em.length < 3) return null
    return findDuplicateInContacts(existingContacts, { email: em })
  }, [email, existingContacts])

  const checkFuzzy = useDebouncedCallback((name: string) => {
    if (forceCreate) return
    const n = name.trim()
    if (n.length < 2) {
      setFuzzyMatch(null)
      return
    }
    let best: Contact | null = null
    let bestScore = 0
    for (const c of existingContacts) {
      const label = (c.company || c.name || '').trim()
      if (!label) continue
      const score = similarityPercent(n, label)
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    setFuzzyMatch(bestScore > 80 ? best : null)
  }, 500)

  useEffect(() => {
    if (step === 0) checkFuzzy(companyName)
  }, [companyName, step, checkFuzzy, forceCreate])

  if (!open) return null

  const reset = () => {
    setStep(0)
    setCompanyName('')
    setWebsite('')
    setPhone('')
    setAddress('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setPersonPhone('')
    setJobTitle('')
    setNote('')
    setLeadSource('')
    setFuzzyMatch(null)
    setForceCreate(false)
  }

  const save = async (skipDup = false) => {
    const cn = companyName.trim()
    if (!cn) return
    const personName = buildPersonName(firstName, lastName)
    await onSubmit({
      company: {
        contact_type: 'company',
        name: cn,
        company: cn,
        website: website.trim(),
        phone: phone.trim(),
        address: address.trim(),
        lead_source: leadSource,
        pipeline_stage: 'first_contact',
        contact_status: 'not_contacted',
        notes: note.trim(),
      },
      person: {
        contact_type: 'person',
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: personName || 'Ansprechpartner',
        email: email.trim(),
        phone: personPhone.trim() || phone.trim(),
        job_title: jobTitle.trim(),
        pipeline_stage: 'first_contact',
        contact_status: 'not_contacted',
      },
    }, { skipDuplicateCheck: skipDup || forceCreate })
    reset()
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="glass-2 font-mono"
        style={{
          width: 'min(440px, 100%)',
          padding: 22,
          borderRadius: 16,
          border: '1px solid var(--glass-border-1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 10, color: 'var(--mode-sales)', marginBottom: 8 }}>
          Neuer Lead · Schritt {step + 1} / 3
        </div>
        {step === 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-display" style={{ fontSize: 18, margin: '0 0 8px' }}>
              Firma
            </h2>
            <input
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value)
                setForceCreate(false)
              }}
              placeholder="Firmenname *"
              style={FIELD}
              autoFocus
            />
            {fuzzyMatch && !forceCreate ? (
              <div
                className="rounded-lg px-3 py-2"
                style={{
                  fontSize: 11,
                  color: 'var(--text-primary)',
                  background: 'color-mix(in srgb, #f59e0b 12%, var(--glass-2))',
                  border: '1px solid color-mix(in srgb, #f59e0b 45%, transparent)',
                }}
              >
                Ähnlicher Kontakt gefunden: {companyDisplayName(fuzzyMatch)} —{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate(`/brand/${slug}/sales/${fuzzyMatch.id}`)
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--mode-sales)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  Öffnen
                </button>{' '}
                <button
                  type="button"
                  onClick={() => {
                    setForceCreate(true)
                    setFuzzyMatch(null)
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  Trotzdem neu anlegen
                </button>
              </div>
            ) : null}
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" style={FIELD} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" style={FIELD} type="tel" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" style={FIELD} />
            <select value={leadSource} onChange={(e) => setLeadSource(e.target.value as LeadSource)} style={FIELD}>
              {LEAD_SOURCE_OPTIONS.map((o) => (
                <option key={o.value || 'none'} value={o.value}>
                  Herkunft: {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-display" style={{ fontSize: 18, margin: '0 0 8px' }}>
              Ansprechpartner
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Vorname" style={FIELD} autoFocus />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nachname" style={FIELD} />
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" style={FIELD} type="email" />
            {emailDup ? (
              <p style={{ fontSize: 11, color: 'var(--accent-coral)', margin: 0 }}>
                Diese E-Mail-Adresse existiert bereits bei:{' '}
                <Link
                  to={`/brand/${slug}/sales/${emailDup.id}`}
                  onClick={onClose}
                  style={{ color: 'var(--accent-coral)' }}
                >
                  {companyDisplayName(emailDup)}
                </Link>
              </p>
            ) : null}
            <input value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} placeholder="Telefon" style={FIELD} type="tel" />
            <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Position" style={FIELD} />
          </div>
        ) : null}
        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <h2 className="font-display" style={{ fontSize: 18, margin: '0 0 8px' }}>
              Notiz
            </h2>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Kontext…" style={{ ...FIELD, resize: 'vertical' }} autoFocus />
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} style={btnGhost}>
              Zurück
            </button>
          ) : (
            <button type="button" onClick={onClose} style={btnGhost}>
              Abbrechen
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              disabled={step === 0 && !companyName.trim()}
              onClick={() => setStep((s) => s + 1)}
              style={btnPrimary}
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(emailDup)}
              onClick={() => void save(forceCreate)}
              style={{
                ...btnPrimary,
                opacity: emailDup ? 0.5 : 1,
                cursor: emailDup ? 'not-allowed' : 'pointer',
              }}
            >
              Speichern & öffnen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}