import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { useContacts, type CreateContactResult } from '../../hooks/useContacts'
import type { Contact } from '../../types/db'

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

type LeadPartial = Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>

export function SalesNewLeadPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const { show: showToast } = useToast()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const phoneRef = useRef<HTMLInputElement>(null)

  const [dupModal, setDupModal] = useState<{
    partial: LeadPartial
    existing: Contact
  } | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => phoneRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

  const finishCreate = useCallback(
    async (partial: LeadPartial) => {
      const r: CreateContactResult = await contacts.create(partial, { skipDuplicateCheck: true })
      if (r.ok) {
        setDupModal(null)
        if (r.syncWarning) {
          showToast(`Kontakt lokal gespeichert (Sync: ${r.syncWarning})`, 'info')
        } else {
          showToast('Kontakt angelegt', 'success')
        }
        navigate(`/brand/${slug}/sales/${r.contact.id}`)
      }
    },
    [contacts, navigate, showToast, slug],
  )

  const submit = useCallback(() => {
    const p = phone.trim()
    const n = name.trim()
    const em = email.trim()
    if (!p && !n && !em) {
      showToast('Mindestens Name, Telefon oder E-Mail eingeben', 'info')
      return
    }
    const partial: LeadPartial = {
      name: n || p || em || 'Neuer Lead',
      email: em,
      phone: p,
      pipeline_stage: 'first_contact',
      notes: note.trim(),
      last_contact_at: p ? new Date().toISOString() : null,
    }
    void contacts.create(partial).then((r) => {
      if (r.ok) {
        if (r.syncWarning) {
          showToast(`Kontakt lokal gespeichert (Sync: ${r.syncWarning})`, 'info')
        } else {
          showToast('Kontakt angelegt', 'success')
        }
        navigate(`/brand/${slug}/sales/${r.contact.id}`)
      } else {
        setDupModal({ partial, existing: r.duplicate })
      }
    })
  }, [contacts, email, name, note, phone, navigate, showToast, slug])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        pointerEvents: 'auto',
        padding: '4px 8px 32px',
      }}
    >
      <Link
        to={`/brand/${slug}/sales`}
        className="font-mono mb-4 inline-block"
        style={{
          fontSize: 12,
          color: 'var(--mode-sales)',
          textDecoration: 'none',
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
        }}
      >
        ← Zurück zur Pipeline
      </Link>

      <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--mode-sales)' }}>
        Sales · Neuer Lead
      </div>
      <h1 className="font-display mb-6" style={{ fontSize: 24, fontWeight: 600 }}>
        Lead anlegen
      </h1>

      <div
        className="glass-2 flex max-w-2xl flex-col gap-4 rounded-2xl p-5"
        style={{ border: '1px solid var(--glass-border-1)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.45 }}>
          Nach dem Anruf: Telefon + Name — landet in Erstkontakt. Enter speichert.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Telefon
          </span>
          <input
            ref={phoneRef}
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={FIELD}
            placeholder="+49 …"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Name / Firma
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={FIELD}
            placeholder="Firma oder Person"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            E-Mail
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={FIELD}
            placeholder="name@…"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Erste Notiz
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            style={{ ...FIELD, resize: 'vertical', minHeight: 96 }}
            placeholder="Kontext, Quelle, nächster Schritt…"
          />
        </label>
        <button
          type="button"
          className="font-mono mt-1"
          style={{
            fontSize: 13,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--mode-sales)',
            background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
          onClick={submit}
        >
          Speichern &amp; öffnen
        </button>
      </div>

      {dupModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            padding: 16,
          }}
        >
          <div
            className="glass-2 font-mono"
            role="dialog"
            aria-modal="true"
            style={{
              width: 'min(400px, 100%)',
              padding: 20,
              borderRadius: 16,
              border: '1px solid var(--glass-border-1)',
              fontSize: 12,
            }}
          >
            <div style={{ marginBottom: 12, fontWeight: 600 }}>Mögliches Duplikat gefunden</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void finishCreate(dupModal.partial)}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--mode-sales)',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                }}
              >
                Trotzdem anlegen
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/brand/${slug}/sales/${dupModal.existing.id}`)
                  setDupModal(null)
                }}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--accent-teal)',
                  color: 'var(--accent-teal)',
                  cursor: 'pointer',
                }}
              >
                Bestehenden öffnen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
