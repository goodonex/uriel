/**
 * Öffentliche Lead-Landingpage je Brand: /leads/:brandSlug
 *
 * URL-Parameter:
 *   ?campaign=foo  → utm_campaign (Bindung an ad_campaigns)
 *   ?source=bar    → utm_source
 *   ?medium=baz    → utm_medium
 *   ?content=xyz   → utm_content
 *
 * Schickt POST an Edge Function `lead-intake`.
 */
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface FormState {
  name: string
  email: string
  phone: string
  company: string
  message: string
  /** Honeypot */
  website: string
}

const INITIAL: FormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  message: '',
  website: '',
}

export function LeadIntakePage() {
  const { brandSlug = '' } = useParams<{ brandSlug: string }>()
  const [params] = useSearchParams()
  const campaign = params.get('campaign') ?? ''
  const source = params.get('source') ?? ''
  const medium = params.get('medium') ?? ''
  const content = params.get('content') ?? ''
  const funnelId = params.get('funnel') ?? ''

  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErrorMsg(null)
    try {
      if (!supabase) {
        setStatus('error')
        setErrorMsg('Service nicht verfügbar.')
        return
      }
      const { data, error } = await supabase.functions.invoke('lead-intake', {
        body: {
          brand_slug: brandSlug,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          message: form.message,
          website: form.website,
          campaign,
          source,
          medium,
          content,
          funnel_id: funnelId || undefined,
        },
      })
      if (error || (data && (data as { error?: string }).error)) {
        setStatus('error')
        setErrorMsg(((data as { error?: string })?.error) || error?.message || 'Übermittlung fehlgeschlagen.')
        return
      }
      setStatus('success')
      setForm(INITIAL)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Übermittlung fehlgeschlagen.')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 50%), radial-gradient(circle at 80% 90%, color-mix(in srgb, var(--accent-blue) 18%, transparent), transparent 50%), var(--bg-deep)',
        display: 'grid',
        placeItems: 'center',
        padding: '60px 24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          borderRadius: 18,
          padding: '36px 32px',
          backdropFilter: 'blur(40px)',
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--accent-teal)',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            ◉ KONTAKT-ANFRAGE
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Lass uns reden.
          </h1>
          <p style={{ marginTop: 10, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Trag dich ein — wir melden uns innerhalb von 24h zurück.
          </p>
          {campaign ? (
            <div
              className="font-mono"
              style={{
                marginTop: 16,
                fontSize: 9,
                letterSpacing: '0.12em',
                color: 'var(--text-tertiary)',
              }}
            >
              REF · {campaign}
              {source ? ` · ${source}` : ''}
            </div>
          ) : null}
        </header>

        {status === 'success' ? (
          <SuccessState />
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              autoComplete="off"
              tabIndex={-1}
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
              aria-hidden="true"
            />

            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <Field
              label="E-Mail *"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
            />
            <Field
              label="Telefon"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
            <Field
              label="Firma"
              value={form.company}
              onChange={(v) => setForm({ ...form, company: v })}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                className="font-mono"
                style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
              >
                NACHRICHT
              </span>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={5}
                placeholder="Worum geht's …"
                style={{
                  padding: '10px 12px',
                  borderRadius: 9,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-2)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </label>

            {errorMsg ? (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  background: 'color-mix(in srgb, var(--accent-coral) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-coral) 40%, transparent)',
                  color: 'var(--accent-coral)',
                  fontSize: 12,
                }}
              >
                {errorMsg}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === 'sending' || !form.name || !form.email}
              className="font-mono"
              style={{
                padding: '14px 18px',
                borderRadius: 11,
                background:
                  status === 'sending'
                    ? 'var(--glass-2)'
                    : 'linear-gradient(135deg, var(--accent-teal), color-mix(in srgb, var(--accent-teal) 70%, var(--accent-blue)))',
                color: status === 'sending' ? 'var(--text-tertiary)' : '#0a1116',
                border: 'none',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.04em',
                cursor: status === 'sending' || !form.name || !form.email ? 'not-allowed' : 'pointer',
                marginTop: 8,
                textTransform: 'uppercase',
              }}
            >
              {status === 'sending' ? '… wird gesendet' : '↗ Anfrage senden'}
            </button>

            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              Mit Klick auf „Anfrage senden" werden deine Daten nur für die Kontaktaufnahme verwendet.
            </p>
          </form>
        )}
      </motion.div>
    </div>
  )
}

function SuccessState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: '32px 24px',
        textAlign: 'center',
        background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-teal) 45%, transparent)',
        borderRadius: 14,
      }}
    >
      <div
        className="font-mono"
        style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--accent-teal)', fontWeight: 600 }}
      >
        ◉ DANKE
      </div>
      <h2
        className="font-display"
        style={{
          marginTop: 10,
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.2,
        }}
      >
        Anfrage angekommen.
      </h2>
      <p style={{ marginTop: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
        Wir melden uns innerhalb von 24 Stunden zurück.
      </p>
    </motion.div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
      >
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
          color: 'var(--text-primary)',
          fontSize: 14,
          outline: 'none',
        }}
      />
    </label>
  )
}
