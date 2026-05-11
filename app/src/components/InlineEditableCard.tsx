import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useBrandFoundationContext } from '../lib/brandFoundationContext'
import {
  requestFoundationSuggestion,
  type FoundationField,
} from '../lib/foundationAi'
import { useSaveStatus } from '../lib/saveStatusContext'
import { AutoSizeTextarea } from './AutoSizeTextarea'
import { useToast } from './Toast'

interface InlineEditableCardProps {
  /** Klein, monospace label oben */
  label: string
  /** Optional: Sub-Label / Helper rechts neben dem Label */
  hint?: string
  /** Aktueller persistierter Wert */
  value: string
  /** Wird bei „Speichern" mit dem neuen Wert aufgerufen */
  onSave: (value: string) => void
  /** Placeholder im Edit-Modus */
  placeholder?: string
  /** Placeholder im Display-Modus, wenn Wert leer */
  emptyText?: string
  /** Optional: Erfolgs-Toast-Message (default: „Gespeichert") */
  toast?: string
  /** Optional: maxLength + Counter */
  maxLength?: number
  /** Optional: Accent-Color (Edit-Border + Save-Button) — default --accent-teal */
  accent?: string
  /** Optional: AI-Feld-Identifier. Wenn gesetzt, erscheint „Mit AI vorschlagen". */
  aiField?: FoundationField
}

/**
 * Schwebende Karte mit festem Text im Default-State.
 *
 * Klick auf die Karte → Edit-Modus mit Auto-Grow-Textarea und Save/Cancel-Aktionen.
 * Speichern persistiert via `onSave` + zeigt Toast. Esc bricht ab.
 */
export function InlineEditableCard({
  label,
  hint,
  value,
  onSave,
  placeholder,
  emptyText = 'Noch nichts eingetragen — Klick zum Bearbeiten',
  toast = 'Gespeichert',
  maxLength,
  accent = 'var(--accent-teal)',
  aiField,
}: InlineEditableCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiVariants, setAiVariants] = useState<string[] | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLDivElement | null>(null)
  const { show } = useToast()
  const foundationCtx = useBrandFoundationContext()
  const saveStatus = useSaveStatus()

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current.querySelector('textarea')
      ta?.focus()
      ta?.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [editing])

  const cancel = () => {
    setDraft(value)
    setEditing(false)
    setAiVariants(null)
    setAiError(null)
  }

  const save = () => {
    if (draft !== value) {
      const end = saveStatus.begin()
      try {
        onSave(draft)
        end(true)
      } catch (err) {
        end(false, (err as Error)?.message ?? 'Speichern fehlgeschlagen')
      }
      show(toast, 'success')
    }
    setEditing(false)
    setAiVariants(null)
    setAiError(null)
  }

  const requestAi = async () => {
    if (!aiField || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    setAiVariants(null)
    try {
      const res = await requestFoundationSuggestion({
        field: aiField,
        current_value: draft,
        brand_name: foundationCtx?.brandName,
        context: foundationCtx?.context,
      })
      setAiVariants(res.variants)
    } catch (err) {
      setAiError((err as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  const dirty = draft !== value
  const isEmpty = !value || !value.trim()
  const counter =
    typeof maxLength === 'number' ? `${draft.length} / ${maxLength}` : null
  const overLimit =
    typeof maxLength === 'number' ? draft.length > maxLength : false

  return (
    <motion.div
      whileHover={editing ? undefined : { y: -1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => {
        if (!editing) setEditing(true)
      }}
      className="glass-2"
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: 18,
        border: `1px solid ${editing ? accent : 'var(--glass-border-1)'}`,
        background: editing
          ? `color-mix(in srgb, ${accent} 4%, var(--glass-2))`
          : 'var(--glass-2)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
        boxShadow: editing
          ? `0 10px 32px color-mix(in srgb, ${accent} 14%, transparent), 0 1px 0 rgba(255,255,255,0.04) inset`
          : '0 6px 22px rgba(0, 0, 0, 0.22), 0 1px 0 rgba(255,255,255,0.03) inset',
        cursor: editing ? 'default' : 'pointer',
        transition: 'border-color 220ms, background 220ms, box-shadow 220ms',
      }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </label>
        <div className="flex items-baseline gap-3">
          {hint ? (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                opacity: 0.7,
              }}
            >
              {hint}
            </span>
          ) : null}
          {counter ? (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: overLimit ? 'var(--accent-coral)' : 'var(--text-tertiary)',
              }}
            >
              {counter}
            </span>
          ) : null}
          {!editing ? (
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                color: 'var(--text-tertiary)',
                opacity: 0.55,
              }}
            >
              Klick zum Bearbeiten
            </span>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div
          ref={textareaRef}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save()
            }
          }}
        >
          <AutoSizeTextarea
            value={draft}
            onChange={setDraft}
            minHeight={64}
            placeholder={placeholder}
            className="w-full rounded-lg outline-none"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              lineHeight: 1.55,
              padding: '10px 12px',
              background: 'var(--glass-1)',
              border: `1px solid ${
                overLimit ? 'var(--accent-coral)' : 'var(--glass-border-1)'
              }`,
              color: 'var(--text-primary)',
            }}
          />

          <AnimatePresence>
            {aiVariants && aiVariants.length > 0 ? (
              <motion.div
                key="ai-variants"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="mt-3 rounded-lg"
                style={{
                  border: `1px solid ${accent}`,
                  background: `color-mix(in srgb, ${accent} 6%, transparent)`,
                  padding: 12,
                }}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.12em',
                      color: accent,
                    }}
                  >
                    ✨ AI-VORSCHLÄGE
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiVariants(null)}
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    schließen
                  </button>
                </div>
                <div className="space-y-2">
                  {aiVariants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setDraft(v)
                        setAiVariants(null)
                      }}
                      className="w-full rounded-md text-left transition-colors"
                      style={{
                        padding: '8px 10px',
                        background: 'var(--glass-1)',
                        border: '1px solid var(--glass-border-1)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = accent
                        e.currentTarget.style.background = `color-mix(in srgb, ${accent} 10%, var(--glass-1))`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--glass-border-1)'
                        e.currentTarget.style.background = 'var(--glass-1)'
                      }}
                    >
                      <div
                        className="font-mono mb-1"
                        style={{
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        VARIANTE {i + 1}
                      </div>
                      <div
                        className="font-body"
                        style={{
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {v}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {aiError ? (
            <div
              className="font-mono mt-2"
              style={{ fontSize: 11, color: 'var(--accent-coral)' }}
            >
              AI-Fehler: {aiError}
            </div>
          ) : null}

          <AnimatePresence>
            {dirty || true ? (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="mt-3 flex flex-wrap items-center justify-end gap-2"
              >
                <span
                  className="font-mono mr-auto"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    opacity: 0.7,
                  }}
                >
                  ⌘+Enter zum Speichern · Esc zum Abbrechen
                </span>
                {aiField ? (
                  <button
                    type="button"
                    className="font-mono"
                    onClick={requestAi}
                    disabled={aiLoading}
                    style={{
                      fontSize: 11,
                      padding: '7px 11px',
                      borderRadius: 9,
                      border: `1px solid ${accent}`,
                      background: aiLoading
                        ? 'transparent'
                        : `color-mix(in srgb, ${accent} 10%, transparent)`,
                      color: accent,
                      cursor: aiLoading ? 'wait' : 'pointer',
                      opacity: aiLoading ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, lineHeight: 1 }}>✨</span>
                    {aiLoading ? 'Denkt …' : 'Mit AI vorschlagen'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="font-mono"
                  onClick={cancel}
                  style={{
                    fontSize: 11,
                    padding: '7px 13px',
                    borderRadius: 9,
                    border: '1px solid var(--glass-border-2)',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  Abbrechen
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.16 }}
                  className="font-mono"
                  onClick={save}
                  disabled={!dirty}
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    padding: '7px 14px',
                    borderRadius: 9,
                    border: `1px solid ${dirty ? accent : 'var(--glass-border-2)'}`,
                    background: dirty
                      ? `color-mix(in srgb, ${accent} 18%, transparent)`
                      : 'var(--glass-1)',
                    color: dirty ? accent : 'var(--text-tertiary)',
                    cursor: dirty ? 'pointer' : 'default',
                    opacity: dirty ? 1 : 0.6,
                  }}
                >
                  Speichern
                </motion.button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : (
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: isEmpty ? 'var(--text-tertiary)' : 'var(--text-primary)',
            fontStyle: isEmpty ? 'italic' : 'normal',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {isEmpty ? emptyText : value}
        </div>
      )}
    </motion.div>
  )
}
