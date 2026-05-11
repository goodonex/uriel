import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const VIBE_OPTIONS = [
  'Professionell',
  'Menschlich',
  'Innovativ',
  'Vertrauenswürdig',
  'Premium',
  'Zugänglich',
  'Direkt',
  'Inspirierend',
] as const

export function OnboardingPublicPage() {
  const { brandId } = useParams<{ brandId: string }>()
  const [qCompany, setQCompany] = useState('')
  const [qIcp, setQIcp] = useState('')
  const [qProblem, setQProblem] = useState('')
  const [qDiff, setQDiff] = useState('')
  const [qNoWords, setQNoWords] = useState('')
  const [vibes, setVibes] = useState<Set<string>>(() => new Set())
  const [website, setWebsite] = useState('')
  const [subName, setSubName] = useState('')
  const [subEmail, setSubEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function toggleVibe(v: string) {
    setVibes((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!brandId || !supabase) {
      setErr('Ungültige Konfiguration.')
      return
    }
    setBusy(true)
    const tone = [...vibes].join(', ')
    const statement = [
      `Was macht dein Unternehmen?\n${qCompany.trim()}`,
      `Größtes Problem der Kunden\n${qProblem.trim()}`,
      `Unterschied zur Konkurrenz\n${qDiff.trim()}`,
      `Wörter / Begriffe vermeiden\n${qNoWords.trim()}`,
      website.trim() ? `Website\n${website.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const icpNotes = [
      `Idealer Kunde\n${qIcp.trim()}`,
      tone ? `Marke soll ausstrahlen\n${tone}` : '',
      subName.trim() || subEmail.trim()
        ? `Kontakt\n${subName.trim()}${subEmail.trim() ? ` · ${subEmail.trim()}` : ''}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const { error } = await supabase.rpc('submit_brand_onboarding', {
      p_brand_id: brandId,
      p_statement: statement,
      p_icp_notes: icpNotes,
      p_tone: tone,
    })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div
        className="font-body flex min-h-screen flex-col items-center justify-center px-6"
        style={{
          pointerEvents: 'auto',
          background: 'var(--bg-base)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="font-display text-center" style={{ fontSize: 22, fontWeight: 600 }}>
          Danke.
        </div>
        <p className="mt-3 text-center" style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
          Wir melden uns.
        </p>
      </div>
    )
  }

  return (
    <div
      className="font-body mx-auto max-w-lg px-5 py-14"
      style={{ pointerEvents: 'auto', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <div className="font-display mb-10" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
        Brand OS
      </div>
      <h1 className="font-display mb-8" style={{ fontSize: 18, fontWeight: 600 }}>
        Kurz-Fragebogen
      </h1>
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-6">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Was macht dein Unternehmen?
          </span>
          <textarea
            required
            value={qCompany}
            onChange={(e) => setQCompany(e.target.value)}
            rows={3}
            style={{
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Wer ist dein idealer Kunde?
          </span>
          <textarea
            required
            value={qIcp}
            onChange={(e) => setQIcp(e.target.value)}
            rows={3}
            style={{
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Was ist das größte Problem deiner Kunden, das du löst?
          </span>
          <textarea
            required
            value={qProblem}
            onChange={(e) => setQProblem(e.target.value)}
            rows={3}
            style={{
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Was unterscheidet dich von der Konkurrenz?
          </span>
          <textarea
            required
            value={qDiff}
            onChange={(e) => setQDiff(e.target.value)}
            rows={3}
            style={{
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Welche Wörter oder Begriffe magst du gar nicht in deiner Kommunikation?
          </span>
          <textarea
            value={qNoWords}
            onChange={(e) => setQNoWords(e.target.value)}
            rows={2}
            style={{
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Was soll deine Marke ausstrahlen?
          </legend>
          <div className="flex flex-col gap-2">
            {VIBE_OPTIONS.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={vibes.has(v)}
                  onChange={() => toggleVibe(v)}
                />
                <span style={{ fontSize: 14 }}>{v}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Website falls vorhanden
          </span>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={{
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              padding: '12px 14px',
              fontSize: 14,
            }}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Dein Name
            </span>
            <input
              type="text"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              style={{
                borderRadius: 12,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
                padding: '12px 14px',
                fontSize: 14,
              }}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              E-Mail für Rückfragen
            </span>
            <input
              type="email"
              value={subEmail}
              onChange={(e) => setSubEmail(e.target.value)}
              style={{
                borderRadius: 12,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
                padding: '12px 14px',
                fontSize: 14,
              }}
            />
          </label>
        </div>

        {err ? (
          <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
            {err}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="font-mono"
          style={{
            marginTop: 8,
            padding: '14px 18px',
            borderRadius: 12,
            border: '1px solid var(--accent-teal)',
            background: 'color-mix(in srgb, var(--accent-teal) 18%, transparent)',
            color: 'var(--accent-teal)',
            fontSize: 13,
            opacity: busy ? 0.65 : 1,
          }}
        >
          Absenden
        </button>
      </form>
    </div>
  )
}
