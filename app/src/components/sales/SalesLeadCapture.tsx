import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../Toast'
import { useContacts } from '../../hooks/useContacts'
import type { Contact } from '../../types/db'

const STAGE_LABEL: Record<Contact['pipeline_stage'], string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Pitch',
  deal: 'Deal',
  paused: 'Pause',
}

function contactCardTitle(c: Contact): string {
  const n = c.name?.trim()
  if (n) return n
  const em = c.email?.trim()
  if (em) return em
  const ph = c.phone?.trim()
  if (ph) return ph
  return 'Unbenannt'
}

/** + Lead, Call Mode — Vollseite für Anlage, Duplikat-Dialog in Pipeline/Listen. */
export function useSalesQuickLead(brandSlug: string, callModeSearch = '') {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const contacts = useContacts(brandSlug)
  const { show: showToast } = useToast()

  const [dupModal, setDupModal] = useState<{
    partial: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>
    existing: Contact
  } | null>(null)

  const openQuickLead = useCallback(() => {
    navigate(`/brand/${brandSlug}/sales/new`)
  }, [brandSlug, navigate])

  useEffect(() => {
    if (searchParams.get('action') !== 'new-contact') return
    openQuickLead()
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('action')
        return next
      },
      { replace: true },
    )
  }, [openQuickLead, searchParams, setSearchParams])

  const finishCreate = useCallback(
    async (partial: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>) => {
      const r = await contacts.create(partial, { skipDuplicateCheck: true })
      if (r.ok) {
        setDupModal(null)
        if (r.syncWarning) {
          showToast(`Kontakt lokal gespeichert (Sync: ${r.syncWarning})`, 'info')
        } else {
          showToast('Kontakt angelegt', 'success')
        }
        navigate(`/brand/${brandSlug}/sales/${r.contact.id}`)
      }
    },
    [brandSlug, contacts, navigate, showToast],
  )

  const tryCreate = useCallback(
    async (partial: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>) => {
      const r = await contacts.create(partial)
      if (r.ok) {
        setDupModal(null)
        if (r.syncWarning) {
          showToast(`Kontakt lokal gespeichert (Sync: ${r.syncWarning})`, 'info')
        } else {
          showToast('Kontakt angelegt', 'success')
        }
        navigate(`/brand/${brandSlug}/sales/${r.contact.id}`)
      } else {
        setDupModal({ partial, existing: r.duplicate })
      }
    },
    [brandSlug, contacts, navigate, showToast],
  )

  const callModeHref = callModeSearch
    ? `/brand/${brandSlug}/sales/call-mode?${callModeSearch}`
    : `/brand/${brandSlug}/sales/call-mode`

  const ActionBar = useCallback(
    function SalesLeadActionBar({ compact = false }: { compact?: boolean }) {
      if (contacts.loading || contacts.error) return null
      return (
        <div
          className="flex flex-wrap items-center gap-2"
          style={{
            marginBottom: compact ? 10 : 0,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="font-mono"
            onClick={openQuickLead}
            style={{
              fontSize: compact ? 11 : 12,
              padding: compact ? '8px 14px' : '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--mode-sales)',
              background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
              color: 'var(--mode-sales)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Lead
          </button>
          <Link
            to={callModeHref}
            className="font-mono"
            style={{
              fontSize: compact ? 11 : 12,
              padding: compact ? '8px 14px' : '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            📞 Call Mode
          </Link>
        </div>
      )
    },
    [callModeHref, contacts.error, contacts.loading, openQuickLead],
  )

  const DrawerEl = useCallback(function SalesQuickLeadDrawerEl() {
    return null
  }, [])

  const DupModalEl = useCallback(
    function SalesLeadDupModalEl() {
      if (!dupModal) return null
      return (
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
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ marginBottom: 12, fontWeight: 600 }}>Mögliches Duplikat gefunden</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              {contactCardTitle(dupModal.existing)} — {(dupModal.existing.email || '—').trim() || '—'} —{' '}
              {STAGE_LABEL[dupModal.existing.pipeline_stage]}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void finishCreate(dupModal.partial)}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                }}
              >
                Trotzdem anlegen
              </button>
              <button
                type="button"
                onClick={() => {
                  const ex = dupModal.existing
                  setDupModal(null)
                  navigate(`/brand/${brandSlug}/sales/${ex.id}`)
                }}
                style={{
                  flex: '1 1 140px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--accent-teal)',
                  background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                  color: 'var(--accent-teal)',
                  cursor: 'pointer',
                }}
              >
                Bestehenden öffnen
              </button>
            </div>
          </div>
        </div>
      )
    },
    [brandSlug, dupModal, finishCreate, navigate],
  )

  return { openQuickLead, ActionBar, DrawerEl, DupModalEl, tryCreate }
}
