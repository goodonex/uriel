import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { AvailabilityWeek, SalesMeetingLink } from '../../types/db'

type Brand = {
  id: string
  name: string
  slug: string
  color: string | null
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_LABELS_DE: Record<(typeof DAY_KEYS)[number], string> = {
  sun: 'Sonntag',
  mon: 'Montag',
  tue: 'Dienstag',
  wed: 'Mittwoch',
  thu: 'Donnerstag',
  fri: 'Freitag',
  sat: 'Samstag',
}

interface Slot {
  iso: string
  label: string
}

function generateSlots(
  availability: AvailabilityWeek,
  durationMin: number,
  bufferMin: number,
): Slot[] {
  const slots: Slot[] = []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let d = 1; d <= 21; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    const key = DAY_KEYS[date.getDay()]
    const dayAvail = availability[key]
    if (!dayAvail || dayAvail.length === 0) continue
    for (const rng of dayAvail) {
      const [fh, fm] = rng.from.split(':').map(Number)
      const [th, tm] = rng.to.split(':').map(Number)
      const startMin = fh * 60 + (fm || 0)
      const endMin = th * 60 + (tm || 0)
      let cur = startMin
      while (cur + durationMin <= endMin) {
        const slot = new Date(date)
        slot.setHours(0, Math.floor(cur), 0, 0)
        if (slot.getTime() > now.getTime() + 60 * 60 * 1000) {
          slots.push({
            iso: slot.toISOString(),
            label: slot.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          })
        }
        cur += durationMin + bufferMin
      }
    }
  }
  return slots
}

export function BookingPublicPage() {
  const { brandSlug, linkSlug } = useParams<{ brandSlug: string; linkSlug: string }>()
  const [brand, setBrand] = useState<Brand | null>(null)
  const [meeting, setMeeting] = useState<SalesMeetingLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chosenSlot, setChosenSlot] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<{ iso: string } | null>(null)

  useEffect(() => {
    if (!brandSlug || !linkSlug) return
    setLoading(true)
    const load = async () => {
      if (!supabase) {
        setError('Supabase nicht konfiguriert.')
        setLoading(false)
        return
      }
      const { data: b, error: be } = await supabase
        .from('brands')
        .select('id, name, slug, color')
        .eq('slug', brandSlug)
        .maybeSingle()
      if (be || !b) {
        setError('Brand nicht gefunden.')
        setLoading(false)
        return
      }
      setBrand(b as Brand)
      const { data: m, error: me } = await supabase
        .from('sales_meeting_links')
        .select('*')
        .eq('brand_id', b.id)
        .eq('slug', linkSlug)
        .eq('is_active', true)
        .maybeSingle()
      if (me || !m) {
        setError('Buchungslink nicht aktiv oder existiert nicht.')
        setLoading(false)
        return
      }
      setMeeting(m as SalesMeetingLink)
      setLoading(false)
    }
    void load()
  }, [brandSlug, linkSlug])

  const slots = useMemo(() => {
    if (!meeting) return []
    return generateSlots(meeting.availability, meeting.duration_minutes, meeting.buffer_minutes)
  }, [meeting])

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      const d = new Date(s.iso)
      const key = d.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries()).slice(0, 10)
  }, [slots])

  const handleSubmit = async () => {
    if (!chosenSlot || !meeting || !brand) return
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name und E-Mail sind Pflicht.')
      return
    }
    setSubmitting(true)
    setError(null)
    const startsAt = new Date(chosenSlot)
    const endsAt = new Date(startsAt.getTime() + meeting.duration_minutes * 60000)
    if (!supabase) {
      setError('Supabase nicht konfiguriert.')
      setSubmitting(false)
      return
    }
    const { error: insErr } = await supabase.from('sales_bookings').insert({
      brand_id: brand.id,
      meeting_link_id: meeting.id,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      message: form.message.trim(),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    setSubmitting(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setConfirmation({ iso: chosenSlot })
  }

  if (loading) {
    return (
      <div
        className="font-body"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 14,
        }}
      >
        Lädt …
      </div>
    )
  }
  if (error && !confirmation) {
    return (
      <div
        className="font-body"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--accent-coral)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <div className="font-display" style={{ fontSize: 22, marginBottom: 8 }}>
            Hmm.
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{error}</div>
        </div>
      </div>
    )
  }
  if (!meeting || !brand) return null

  const accent =
    brand.color && !brand.color.startsWith('var(') ? brand.color : 'var(--accent-teal)'

  return (
    <div
      className="font-body"
      style={{
        minHeight: '100vh',
        padding: '40px 24px',
        background:
          'radial-gradient(ellipse at top, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 60%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ maxWidth: 720, margin: '0 auto' }}
      >
        <div
          style={{
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              color: accent,
              marginBottom: 10,
            }}
          >
            {brand.name.toUpperCase()}
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.5px',
              marginBottom: 8,
            }}
          >
            {meeting.title}
          </h1>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {meeting.duration_minutes} Min. ·{' '}
            {meeting.description || 'Wähle einen passenden Termin.'}
          </div>
        </div>

        {confirmation ? (
          <ConfirmationCard
            accent={accent}
            iso={confirmation.iso}
            duration={meeting.duration_minutes}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
            }}
          >
            <div>
              <SectionLabel>Verfügbare Termine</SectionLabel>
              <div
                style={{
                  maxHeight: 460,
                  overflowY: 'auto',
                  padding: 4,
                }}
              >
                {slotsByDay.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Aktuell keine freien Slots.
                  </div>
                ) : (
                  slotsByDay.map(([day, daySlots]) => {
                    const d = new Date(day)
                    return (
                      <div key={day} style={{ marginBottom: 14 }}>
                        <div
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            color: 'var(--text-tertiary)',
                            letterSpacing: '0.12em',
                            marginBottom: 6,
                          }}
                        >
                          {DAY_LABELS_DE[DAY_KEYS[d.getDay()]]} ·{' '}
                          {d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {daySlots.map((s) => (
                            <button
                              key={s.iso}
                              type="button"
                              onClick={() => setChosenSlot(s.iso)}
                              className="font-mono"
                              style={{
                                fontSize: 12,
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: `1px solid ${
                                  chosenSlot === s.iso ? accent : 'var(--glass-border-2)'
                                }`,
                                background:
                                  chosenSlot === s.iso
                                    ? `color-mix(in srgb, ${accent} 18%, transparent)`
                                    : 'var(--glass-1)',
                                color:
                                  chosenSlot === s.iso ? accent : 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <SectionLabel>Deine Infos</SectionLabel>
              <Field label="Name *">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={input}
                  required
                />
              </Field>
              <Field label="E-Mail *">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={input}
                  required
                />
              </Field>
              <Field label="Telefon">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={input}
                />
              </Field>
              <Field label="Nachricht (optional)">
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </Field>

              {error ? (
                <div
                  style={{
                    color: 'var(--accent-coral)',
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!chosenSlot || submitting || !form.name || !form.email}
                className="font-mono"
                style={{
                  width: '100%',
                  padding: '12px 18px',
                  fontSize: 13,
                  borderRadius: 10,
                  border: `1px solid ${accent}`,
                  background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                  color: accent,
                  fontWeight: 600,
                  cursor:
                    !chosenSlot || submitting || !form.name || !form.email
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    !chosenSlot || submitting || !form.name || !form.email ? 0.55 : 1,
                }}
              >
                {submitting
                  ? 'Wird gebucht …'
                  : chosenSlot
                    ? `Termin buchen · ${new Date(chosenSlot).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : 'Bitte Slot wählen'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        color: 'var(--text-tertiary)',
        marginBottom: 10,
      }}
    >
      {String(children).toUpperCase()}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          marginBottom: 3,
        }}
      >
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
}

function ConfirmationCard({
  accent,
  iso,
  duration,
}: {
  accent: string
  iso: string
  duration: number
}) {
  const d = new Date(iso)
  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        padding: 28,
        borderRadius: 16,
        border: `1px solid ${accent}`,
        background: `color-mix(in srgb, ${accent} 10%, transparent)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 40,
          marginBottom: 10,
          color: accent,
        }}
      >
        ✓
      </div>
      <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>
        Termin gebucht
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {d.toLocaleString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        · {duration} Min
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Du bekommst gleich eine Bestätigung per Mail.
      </p>
    </motion.div>
  )
}
