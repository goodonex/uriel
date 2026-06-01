import { useEffect, useRef, useState } from 'react'
import type { ActivityModalType } from '../../../lib/activityTypes'
import { ACTIVITY_META, DROPDOWN_ACTIVITIES } from '../../../lib/activityTypes'
import type { Contact } from '../../../types/db'
import { ContactListMenuItems } from './ContactListMenuItems'

export function ContactActivityActionBar({
  brandSlug,
  contact,
  onOpenModal,
  onOpenEmail,
  onCall,
  variant = 'card',
}: {
  brandSlug: string
  contact: Contact
  onOpenModal: (type: ActivityModalType) => void
  onOpenEmail: () => void
  onCall: () => void
  variant?: 'card' | 'header'
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen])

  const ghostBtn = {
    fontSize: 11,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--glass-border-2)',
    background: 'var(--glass-2)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  } as const

  const buttons = (
    <>
      <button type="button" className="font-mono" style={ghostBtn} onClick={() => onOpenModal('termin')}>
        ◷ Termin
      </button>
      <button type="button" className="font-mono" style={ghostBtn} onClick={() => onOpenModal('notiz')}>
        ✎ Notiz
      </button>
      <button type="button" className="font-mono" style={ghostBtn} onClick={onOpenEmail}>
        ✉ E-Mail
      </button>
      <button type="button" className="font-mono" style={ghostBtn} onClick={onCall}>
        ☎ Anruf protokollieren
      </button>
      <div ref={menuRef} style={{ position: 'relative', marginLeft: variant === 'header' ? 0 : 'auto' }}>
          <button
            type="button"
            className="font-mono"
            style={{
              ...ghostBtn,
              border: menuOpen ? '1px solid var(--mode-sales)' : ghostBtn.border,
              color: menuOpen ? 'var(--mode-sales)' : ghostBtn.color,
            }}
            onClick={() => setMenuOpen((o) => !o)}
          >
            Aktivität ▾
          </button>
          {menuOpen ? (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                zIndex: 30,
                minWidth: 240,
                padding: 6,
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                maxHeight: 360,
                overflowY: 'auto',
              }}
            >
              {DROPDOWN_ACTIVITIES.map((item) => (
                <div key={item.type}>
                  {item.dividerBefore ? (
                    <div style={{ height: 1, background: 'var(--glass-border-2)', margin: '6px 0' }} />
                  ) : null}
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenModal(item.type)
                    }}
                    style={menuItemStyle}
                  >
                    <span>{ACTIVITY_META[item.type].icon}</span>
                    <span>
                      {item.type === 'unqualified' ||
                      item.type === 'noshow' ||
                      item.type === 'followup' ||
                      item.type === 'formular'
                        ? `X - ${ACTIVITY_META[item.type].label}`
                        : ACTIVITY_META[item.type].label}
                    </span>
                  </button>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--glass-border-2)', margin: '6px 0' }} />
              <ContactListMenuItems
                brandSlug={brandSlug}
                contact={contact}
                onPicked={() => setMenuOpen(false)}
              />
            </div>
          ) : null}
        </div>
    </>
  )

  if (variant === 'header') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
        {buttons}
      </div>
    )
  }

  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: 12,
      }}
    >
      <div
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 8 }}
      >
        AKTIONEN
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{buttons}</div>
    </section>
  )
}

const menuItemStyle = {
  display: 'flex',
  width: '100%',
  gap: 8,
  alignItems: 'center',
  textAlign: 'left' as const,
  fontSize: 11,
  padding: '8px 10px',
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}
