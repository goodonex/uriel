import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useEmailLogs, useEmailTemplates } from '../../hooks/useSalesPro'
import { useBrandId } from '../../hooks/useBrandId'
import { usePositioning } from '../../hooks/usePositioning'
import { sendEmail } from '../../lib/emailService'
import {
  availableVariables,
  buildMailtoUrl,
  renderEmailTemplate,
} from '../../lib/emailVariables'
import type { Contact, SalesEmailTemplate } from '../../types/db'
import { useToast } from '../Toast'

interface EmailComposeDialogProps {
  open: boolean
  onClose: () => void
  brandSlug: string
  brandName?: string
  contact: Contact
  /** Wird mit dem frisch erzeugten Log-Eintrag aufgerufen, damit Parent UI aktualisieren kann. */
  onLogged?: (subject: string) => void
  /** Vor-ausgewähltes Template per ID */
  initialTemplateId?: string | null
}

export function EmailComposeDialog({
  open,
  onClose,
  brandSlug,
  brandName,
  contact,
  onLogged,
  initialTemplateId,
}: EmailComposeDialogProps) {
  const tpl = useEmailTemplates(brandSlug)
  const logs = useEmailLogs(brandSlug, { contactId: contact.id })
  const positioning = usePositioning(brandSlug)
  const brandId = useBrandId(brandSlug)
  const { show } = useToast()

  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const selectedTpl = useMemo(
    () => tpl.items.find((t) => t.id === templateId) ?? null,
    [tpl.items, templateId],
  )

  const renderCtx = useMemo(
    () => ({ contact, brandName, positioning: positioning.item ?? null }),
    [contact, brandName, positioning.item],
  )

  useEffect(() => {
    if (!open) return
    if (selectedTpl) {
      setSubject(renderEmailTemplate(selectedTpl.subject, renderCtx))
      setBody(renderEmailTemplate(selectedTpl.body, renderCtx))
    }
  }, [selectedTpl, open, renderCtx])

  useEffect(() => {
    if (open && !templateId) {
      setSubject('')
      setBody('')
    }
  }, [open, templateId])

  const handleSend = async () => {
    if (sending) return
    if (!contact.email) {
      show('Kontakt hat keine E-Mail-Adresse', 'info')
      return
    }
    const finalSubject = subject || '(Kein Betreff)'
    const finalBody = body
    setSending(true)
    if (brandId) {
      // Versand über Edge-Function (Resend + Pixel + Log)
      const res = await sendEmail({
        brand_id: brandId,
        contact_id: contact.id,
        subject: finalSubject,
        body: finalBody,
        template_id: templateId,
      })
      if (res.ok) {
        show('Mail versendet & geloggt', 'success')
        await logs.reload()
      } else if (res.error === 'resend_api_key_missing') {
        show('RESEND_API_KEY fehlt — Mail-Versand inaktiv', 'info')
      } else {
        // Fallback auf mailto, wenn Edge-Function nicht erreichbar
        const url = buildMailtoUrl({ to: contact.email, subject: finalSubject, body: finalBody })
        window.location.href = url
        await logs.log({
          contact_id: contact.id,
          template_id: templateId,
          subject: finalSubject,
          body_preview: finalBody.slice(0, 240),
        })
        show(`mailto-Fallback (${res.error ?? 'unknown'})`, 'info')
      }
    } else {
      // Kein Brand-ID → reines mailto + Local-Log
      const url = buildMailtoUrl({ to: contact.email, subject: finalSubject, body: finalBody })
      window.location.href = url
      await logs.log({
        contact_id: contact.id,
        template_id: templateId,
        subject: finalSubject,
        body_preview: finalBody.slice(0, 240),
      })
      show('Mail (mailto) gesendet', 'success')
    }
    onLogged?.(finalSubject)
    setSubject('')
    setBody('')
    setTemplateId(null)
    setSending(false)
    onClose()
  }

  const insertVariable = (key: string) => {
    setBody((b) => `${b}{{${key}}}`)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
          style={{
            background: 'rgba(8, 12, 22, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
          }}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="font-body"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(18,18,22,0.95)',
              border: '1px solid var(--glass-border-2)',
              borderRadius: 16,
              boxShadow: '0 28px 60px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 10,
              }}
            >
              <div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.12em' }}
                >
                  MAIL AN
                </div>
                <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
                  {contact.name || contact.email || 'Unbenannter Kontakt'}
                  {contact.email ? (
                    <span
                      style={{
                        color: 'var(--text-tertiary)',
                        fontSize: 12,
                        marginLeft: 8,
                        fontWeight: 400,
                      }}
                    >
                      &lt;{contact.email}&gt;
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--glass-border-2)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                Esc
              </button>
            </header>

            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {!contact.email ? (
                <div
                  style={{
                    padding: 10,
                    marginBottom: 12,
                    borderRadius: 8,
                    background: 'color-mix(in srgb, var(--accent-coral) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-coral) 28%, transparent)',
                    fontSize: 12,
                    color: 'var(--accent-coral)',
                  }}
                >
                  Kein E-Mail-Adresse hinterlegt — du kannst trotzdem manuell loggen.
                </div>
              ) : null}

              <TemplateRow templates={tpl.items} selectedId={templateId} onSelect={setTemplateId} />

              <Field label="Betreff">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Betreff …"
                  style={inputStyle}
                />
              </Field>

              <Field label="Body">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  placeholder={'Hi {{first_name}},\n\n…'}
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </Field>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 6,
                  paddingTop: 8,
                  borderTop: '1px dashed var(--glass-border-1)',
                }}
              >
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)', marginRight: 6, alignSelf: 'center' }}
                >
                  Variablen:
                </span>
                {availableVariables().map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '3px 7px',
                      borderRadius: 999,
                      border: '1px solid var(--glass-border-2)',
                      background: 'var(--glass-1)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                className="font-mono"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                Öffnet deinen Mail-Client. Mail wird im Lead-Log eingetragen.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--glass-border-2)',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={(!subject && !body) || sending}
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--mode-sales)',
                    background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
                    color: 'var(--mode-sales)',
                    cursor: sending ? 'wait' : 'pointer',
                    fontWeight: 600,
                    opacity: (!subject && !body) || sending ? 0.5 : 1,
                  }}
                >
                  {sending
                    ? 'Senden …'
                    : contact.email
                      ? '↗ Senden via Resend'
                      : 'Nur Loggen'}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
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
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function TemplateRow({
  templates,
  selectedId,
  onSelect,
}: {
  templates: SalesEmailTemplate[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  if (templates.length === 0) {
    return (
      <div
        style={{
          padding: 8,
          marginBottom: 12,
          fontSize: 11,
          color: 'var(--text-tertiary)',
          background: 'var(--glass-1)',
          borderRadius: 8,
          border: '1px dashed var(--glass-border-1)',
        }}
      >
        Noch keine Templates angelegt. Du kannst trotzdem manuell schreiben.
      </div>
    )
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          marginBottom: 4,
        }}
      >
        TEMPLATE
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid var(--glass-border-2)',
            background: selectedId === null ? 'var(--glass-2)' : 'transparent',
            color: selectedId === null ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
        >
          Freitext
        </button>
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              borderRadius: 999,
              border: `1px solid ${
                selectedId === t.id ? 'var(--mode-sales)' : 'var(--glass-border-2)'
              }`,
              background:
                selectedId === t.id
                  ? 'color-mix(in srgb, var(--mode-sales) 16%, transparent)'
                  : 'transparent',
              color: selectedId === t.id ? 'var(--mode-sales)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t.name}
            {t.stage ? (
              <span style={{ fontSize: 9, marginLeft: 6, color: 'var(--text-tertiary)' }}>
                · {t.stage}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
