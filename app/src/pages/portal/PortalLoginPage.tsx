import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/**
 * Kunden-Login fürs Portal: E-Mail + Passwort. Bestehende Client-Session →
 * direkt ins eigene Projekt. „Passwort vergessen?" schickt einen neuen
 * Setup-Link (recovery → /portal/setup).
 */
export function PortalLoginPage() {
  const navigate = useNavigate()
  const { user, role, clientProjectId, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  // Schon eingeloggt? Client → eigenes Projekt, Owner → Cockpit.
  useEffect(() => {
    if (loading || !user) return
    if (role === 'client' && clientProjectId) {
      navigate(`/portal/${clientProjectId}`, { replace: true })
    } else if (role === 'owner') {
      navigate('/', { replace: true })
    }
  }, [loading, user, role, clientProjectId, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!supabase) {
      setError('Verbindung nicht konfiguriert.')
      return
    }
    setBusy(true)
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signErr) throw signErr
      // Redirect übernimmt der useEffect, sobald Rolle geladen ist.
    } catch (err) {
      setError(
        err instanceof Error && /invalid/i.test(err.message)
          ? 'E-Mail oder Passwort ist falsch.'
          : err instanceof Error
            ? err.message
            : 'Anmeldung fehlgeschlagen.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleForgot() {
    setError(null)
    const addr = email.trim().toLowerCase()
    if (!addr) {
      setError('Gib zuerst deine E-Mail-Adresse ein.')
      return
    }
    if (!supabase) return
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/portal/setup`,
    })
    if (resetErr) setError(resetErr.message)
    else setResetSent(true)
  }

  const field = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border-1)',
    color: 'var(--text-primary)',
    fontSize: 14,
  } as const

  return (
    <div
      style={{
        pointerEvents: 'auto',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-base)',
      }}
    >
      <div
        className="glass-2"
        style={{
          width: '100%',
          maxWidth: 380,
          borderRadius: 20,
          padding: '28px 26px',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
        }}
      >
        <div
          className="font-mono mb-2"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent-blue)',
          }}
        >
          Kundenportal
        </div>
        <h1
          className="font-display mb-6"
          style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}
        >
          Anmelden
        </h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              E-Mail
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              style={field}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Passwort
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              style={field}
            />
          </div>

          {error ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
              {error}
            </p>
          ) : null}
          {resetSent ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-teal)' }}>
              Link zum Zurücksetzen ist unterwegs — check dein Postfach.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="font-mono"
            style={{
              marginTop: 4,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--accent-blue)',
              fontSize: 13,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '…' : 'Anmelden'}
          </button>

          <button
            type="button"
            onClick={() => void handleForgot()}
            className="font-mono"
            style={{
              padding: '4px 0',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Passwort vergessen?
          </button>
        </form>
      </div>
    </div>
  )
}
