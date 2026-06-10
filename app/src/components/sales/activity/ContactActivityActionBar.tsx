import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ActivityModalType } from '../../../lib/activityTypes'
import { ACTIVITY_META, DROPDOWN_ACTIVITIES } from '../../../lib/activityTypes'
import type { Contact, OpportunityProduct } from '../../../types/db'
import { OPPORTUNITY_PRODUCT_META } from '../../../lib/opportunityMeta'
import { SALES_DROPDOWN_PANEL, SALES_MODAL_Z } from './salesModalUi'
import { ContactListMenuItems } from './ContactListMenuItems'

export function ContactActivityActionBar({
  brandSlug,
  contact,
  onOpenModal,
  onOpenEmail,
  onCall,
  variant = 'card',
  addOpportunityProducts,
  onAddOpportunity,
}: {
  brandSlug: string
  contact: Contact
  onOpenModal: (type: ActivityModalType) => void
  onOpenEmail: () => void
  onCall: () => void
  variant?: 'card' | 'header'
  addOpportunityProducts?: OpportunityProduct[]
  onAddOpportunity?: (product: OpportunityProduct) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [oppMenuOpen, setOppMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const oppMenuRef = useRef<HTMLDivElement>(null)
  const oppTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen && !oppMenuOpen) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuOpen) {
        if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return
        setMenuOpen(false)
      }
      if (oppMenuOpen) {
        if (oppMenuRef.current?.contains(t) || oppTriggerRef.current?.contains(t)) return
        setOppMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menuOpen, oppMenuOpen])

  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return
    const place = () => {
      const r = triggerRef.current!.getBoundingClientRect()
      const width = Math.max(240, r.width)
      let left = r.right - width
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      setMenuPos({ top: r.bottom + 6, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [menuOpen])

  const ghostBtn = {
    fontSize: 11,
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid var(--glass-border-2)',
    background: 'color-mix(in srgb, var(--bg-base) 90%, var(--glass-2))',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  } as const

  const menuPanel =
    menuOpen && menuPos ? (
      <div
        ref={menuRef}
        className="font-mono"
        role="menu"
        style={{
          ...SALES_DROPDOWN_PANEL,
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: SALES_MODAL_Z - 1,
        }}
      >
        {DROPDOWN_ACTIVITIES.map((item) => (
          <div key={item.type}>
            {item.dividerBefore ? (
              <div style={{ height: 1, background: 'var(--glass-border-2)', margin: '6px 0' }} />
            ) : null}
            <button
              type="button"
              role="menuitem"
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
    ) : null

  const showAddOpportunity =
    addOpportunityProducts && addOpportunityProducts.length > 0 && onAddOpportunity

  const oppMenuPanel =
    oppMenuOpen && showAddOpportunity ? (
      <div
        ref={oppMenuRef}
        className="font-mono"
        role="menu"
        style={{
          ...SALES_DROPDOWN_PANEL,
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          minWidth: 180,
          zIndex: SALES_MODAL_Z - 1,
        }}
      >
        {addOpportunityProducts.map((product) => (
          <button
            key={product}
            type="button"
            role="menuitem"
            className="font-mono"
            onClick={() => {
              setOppMenuOpen(false)
              onAddOpportunity(product)
            }}
            style={menuItemStyle}
          >
            {OPPORTUNITY_PRODUCT_META[product].label}
          </button>
        ))}
      </div>
    ) : null

  const buttons = (
    <>
      {showAddOpportunity ? (
        <div style={{ position: 'relative' }}>
          <button
            ref={oppTriggerRef}
            type="button"
            className="font-mono"
            style={{
              ...ghostBtn,
              border: oppMenuOpen ? '1px solid var(--mode-sales)' : ghostBtn.border,
              color: oppMenuOpen ? 'var(--mode-sales)' : ghostBtn.color,
            }}
            onClick={() => setOppMenuOpen((o) => !o)}
            aria-expanded={oppMenuOpen}
            aria-haspopup="menu"
          >
            + Opportunity
          </button>
          {oppMenuPanel}
        </div>
      ) : null}
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
        ☎ Anruf
      </button>
      <div style={{ position: 'relative', marginLeft: variant === 'header' ? 0 : 'auto' }}>
        <button
          ref={triggerRef}
          type="button"
          className="font-mono"
          style={{
            ...ghostBtn,
            border: menuOpen ? '1px solid var(--mode-sales)' : ghostBtn.border,
            color: menuOpen ? 'var(--mode-sales)' : ghostBtn.color,
          }}
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          Aktivität ▾
        </button>
      </div>
      {menuPanel ? createPortal(menuPanel, document.body) : null}
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
  color: 'var(--text-primary)',
  cursor: 'pointer',
}
