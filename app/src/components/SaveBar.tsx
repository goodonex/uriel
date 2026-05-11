import { motion } from 'framer-motion'
import { useToast } from './Toast'

interface SaveBarProps {
  onSave: () => void
  /** Optional: Custom-Label statt "Speichern" */
  label?: string
  /** Optional: Toast-Message bei Erfolg (default: "Gespeichert") */
  toast?: string
  /** Optional: Right-aligned helper text vor dem Button */
  hint?: string
  /** Optional: Accent-Color override (default: --accent-teal) */
  accent?: string
}

/**
 * Visueller Speichern-Button für die Foundation-Sections.
 *
 * Auto-Save läuft via Debounce im Hintergrund — der Button liefert die
 * haptische Bestätigung ("Gespeichert"-Toast) und einen klaren Anker für
 * den Nutzer.
 */
export function SaveBar({
  onSave,
  label = 'Speichern',
  toast = 'Gespeichert',
  hint,
  accent = 'var(--accent-teal)',
}: SaveBarProps) {
  const { show } = useToast()

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-3"
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: '1px solid var(--glass-border-1)',
      }}
    >
      {hint ? (
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
          }}
        >
          {hint}
        </span>
      ) : null}
      <motion.button
        type="button"
        className="font-mono"
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={() => {
          onSave()
          show(toast, 'success')
        }}
        style={{
          fontSize: 12,
          letterSpacing: '0.04em',
          padding: '9px 18px',
          borderRadius: 10,
          border: `1px solid ${accent}`,
          background: `color-mix(in srgb, ${accent} 16%, transparent)`,
          color: accent,
          cursor: 'pointer',
        }}
      >
        {label}
      </motion.button>
    </div>
  )
}
