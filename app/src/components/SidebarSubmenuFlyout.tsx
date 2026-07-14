import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface SidebarSubmenuFlyoutProps {
  visible: boolean
  left: number
  title: string
  accentVar: string
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: ReactNode
}

export function SidebarSubmenuFlyout({
  visible,
  left,
  title,
  accentVar,
  onMouseEnter,
  onMouseLeave,
  children,
}: SidebarSubmenuFlyoutProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={title}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="font-body"
          style={{
            position: 'fixed',
            left,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 46,
            width: 220,
            maxHeight: 'min(420px, calc(100vh - 48px))',
            overflowY: 'auto',
            borderRadius: 14,
            border: '1px solid var(--glass-border-1)',
            background: 'var(--surface-popover)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'auto',
          }}
        >
          <div
            className="font-mono sticky top-0 px-3 py-2"
            style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: `var(${accentVar})`,
              borderBottom: '1px solid var(--glass-border-1)',
              background: 'var(--surface-popover)',
            }}
          >
            {title}
          </div>
          <div className="flex flex-col gap-0.5 p-2">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function FlyoutLink({
  to,
  active,
  accentVar,
  label,
  onClick,
}: {
  to: string
  active?: boolean
  accentVar: string
  label: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <Link
      to={to}
      data-no-scale
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg truncate transition-colors"
      style={{
        textDecoration: 'none',
        padding: '7px 10px',
        fontSize: 11,
        color: active ? `var(${accentVar})` : 'var(--text-secondary)',
        background: active ? 'var(--glass-2)' : 'transparent',
        border: `1px solid ${active ? 'var(--glass-border-2)' : 'transparent'}`,
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: active ? `var(${accentVar})` : 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      />
      <span className="truncate" style={{ fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </Link>
  )
}
