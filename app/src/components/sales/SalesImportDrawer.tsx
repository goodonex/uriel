import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useContacts } from '../../hooks/useContacts'
import type { Contact, PipelineStage } from '../../types/db'
import { useToast } from '../Toast'

interface SalesImportDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
}

type FieldKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'company'
  | 'website'
  | 'ansprechpartner'
  | 'notes'
  | 'pipeline_stage'
  | 'potenzial_betrag'
  | 'tags'
  | 'skip'

const FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: 'skip', label: '— Nicht importieren —' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'E-Mail' },
  { key: 'phone', label: 'Telefon' },
  { key: 'company', label: 'Firma' },
  { key: 'website', label: 'Website' },
  { key: 'ansprechpartner', label: 'Ansprechpartner' },
  { key: 'notes', label: 'Notizen' },
  { key: 'pipeline_stage', label: 'Pipeline-Stage' },
  { key: 'potenzial_betrag', label: 'Potenzial €' },
  { key: 'tags', label: 'Tags (komma)' },
]

const STAGE_MAP: Record<string, PipelineStage> = {
  first_contact: 'first_contact',
  erstkontakt: 'first_contact',
  gespraech: 'conversation',
  gespräch: 'conversation',
  conversation: 'conversation',
  angebot: 'proposal',
  proposal: 'proposal',
  deal: 'deal',
  pause: 'paused',
  paused: 'paused',
}

function parseCSV(text: string): string[][] {
  // Einfacher CSV-Parser inkl. Quoted-Felder
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',' || ch === ';' || ch === '\t') {
        cur.push(field)
        field = ''
      } else if (ch === '\n') {
        cur.push(field)
        rows.push(cur)
        cur = []
        field = ''
      } else if (ch === '\r') {
        /* skip */
      } else {
        field += ch
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field)
    rows.push(cur)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

function autoMap(header: string): FieldKey {
  const h = header.toLowerCase().trim()
  if (/(^| )name|vorname|nachname/.test(h)) return 'name'
  if (h.includes('mail')) return 'email'
  if (h.includes('tel') || h.includes('phone')) return 'phone'
  if (h.includes('firma') || h.includes('company') || h.includes('unternehmen')) return 'company'
  if (h.includes('web') || h.includes('url')) return 'website'
  if (h.includes('ansprech')) return 'ansprechpartner'
  if (h.includes('note') || h.includes('notiz')) return 'notes'
  if (h.includes('stage') || h.includes('phase') || h.includes('status')) return 'pipeline_stage'
  if (h.includes('potenzial') || h.includes('budget') || h.includes('value') || h.includes('€'))
    return 'potenzial_betrag'
  if (h.includes('tag')) return 'tags'
  return 'skip'
}

export function SalesImportDrawer({ open, onClose, brandSlug }: SalesImportDrawerProps) {
  const contacts = useContacts(brandSlug)
  const { show } = useToast()
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<FieldKey[]>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setRaw('')
      setRows([])
      setMapping([])
    }
  }, [open])

  const handleParse = (text: string) => {
    setRaw(text)
    const parsed = parseCSV(text)
    setRows(parsed)
    if (parsed.length > 0) {
      const header = parsed[0]
      setMapping(header.map((h) => autoMap(h)))
    }
  }

  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader])

  const validCount = useMemo(() => {
    const nameIdx = mapping.indexOf('name')
    const emailIdx = mapping.indexOf('email')
    if (nameIdx < 0 && emailIdx < 0) return 0
    return dataRows.filter((r) => {
      const n = nameIdx >= 0 ? (r[nameIdx] ?? '').trim() : ''
      const e = emailIdx >= 0 ? (r[emailIdx] ?? '').trim() : ''
      return n.length > 0 || e.length > 0
    }).length
  }, [dataRows, mapping])

  const handleImport = async () => {
    if (validCount === 0) {
      show('Keine importierbaren Zeilen', 'info')
      return
    }
    setBusy(true)
    let success = 0
    let dups = 0
    let errors = 0
    for (const row of dataRows) {
      const partial: Partial<Contact> = {}
      mapping.forEach((key, idx) => {
        const raw = (row[idx] ?? '').trim()
        if (!raw || key === 'skip') return
        switch (key) {
          case 'name':
          case 'email':
          case 'phone':
          case 'company':
          case 'website':
          case 'ansprechpartner':
          case 'notes':
            partial[key] = raw as never
            break
          case 'pipeline_stage': {
            const m = STAGE_MAP[raw.toLowerCase()]
            if (m) partial.pipeline_stage = m
            break
          }
          case 'potenzial_betrag': {
            const n = parseInt(raw.replace(/[^\d]/g, ''), 10)
            if (Number.isFinite(n)) partial.potenzial_betrag = n
            break
          }
          case 'tags':
            partial.tags = raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
            break
        }
      })
      if (!partial.name && !partial.email) continue
      try {
        const result = await contacts.create(partial)
        if (result.ok) success++
        else dups++
      } catch {
        errors++
      }
    }
    setBusy(false)
    show(
      `Import: ${success} neu, ${dups} Duplikate, ${errors} Fehler`,
      success > 0 ? 'success' : 'info',
    )
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
          style={{ background: 'rgba(8,12,22,0.55)', backdropFilter: 'blur(8px)' }}
        >
          <motion.aside
            initial={{ x: 720 }}
            animate={{ x: 0 }}
            exit={{ x: 720 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="font-body"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 760,
              background: 'rgba(18,18,22,0.96)',
              borderLeft: '1px solid var(--glass-border-2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
                >
                  SALES · CSV-IMPORT
                </div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
                  Leads aus CSV laden
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--glass-border-2)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                Esc
              </button>
            </header>

            <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
              {rows.length === 0 ? (
                <>
                  <label
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      color: 'var(--text-tertiary)',
                      marginBottom: 6,
                      display: 'block',
                    }}
                  >
                    CSV-INHALT EINFÜGEN
                  </label>
                  <textarea
                    value={raw}
                    onChange={(e) => handleParse(e.target.value)}
                    rows={14}
                    placeholder="Name,Email,Telefon,Firma\nMax Mustermann,max@ex.de,..."
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--glass-border-2)',
                      background: 'var(--glass-1)',
                      color: 'var(--text-primary)',
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: 12,
                      outline: 'none',
                      resize: 'vertical',
                    }}
                  />
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const text = await file.text()
                      handleParse(text)
                    }}
                    style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}
                  />
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 12,
                    }}
                  >
                    <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {rows.length} Zeilen · {validCount} importierbar
                    </div>
                    <label
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={hasHeader}
                        onChange={(e) => setHasHeader(e.target.checked)}
                      />
                      Erste Zeile ist Header
                    </label>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {rows[0]?.map((h, idx) => (
                            <th key={idx} style={{ padding: 6, textAlign: 'left' }}>
                              <select
                                value={mapping[idx] ?? 'skip'}
                                onChange={(e) => {
                                  const next = [...mapping]
                                  next[idx] = e.target.value as FieldKey
                                  setMapping(next)
                                }}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  fontSize: 11,
                                  border: '1px solid var(--glass-border-2)',
                                  background: 'var(--glass-2)',
                                  color: 'var(--text-primary)',
                                  borderRadius: 6,
                                }}
                              >
                                {FIELDS.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                              <div
                                className="font-mono"
                                style={{
                                  fontSize: 9,
                                  color: 'var(--text-tertiary)',
                                  marginTop: 3,
                                  textAlign: 'center',
                                }}
                              >
                                {hasHeader ? h : `Spalte ${idx + 1}`}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(hasHeader ? rows.slice(1, 6) : rows.slice(0, 5)).map((r, ri) => (
                          <tr key={ri}>
                            {r.map((c, ci) => (
                              <td
                                key={ci}
                                style={{
                                  padding: 6,
                                  border: '1px solid var(--glass-border-1)',
                                  color: 'var(--text-secondary)',
                                  background: 'var(--glass-1)',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 160,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setRaw('')
                  setRows([])
                  setMapping([])
                }}
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
                Neu
              </button>
              <button
                type="button"
                disabled={validCount === 0 || busy}
                onClick={() => void handleImport()}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
                  color: 'var(--mode-sales)',
                  fontWeight: 600,
                  cursor: validCount > 0 ? 'pointer' : 'not-allowed',
                  opacity: validCount > 0 ? 1 : 0.5,
                }}
              >
                {busy ? 'Lädt …' : `${validCount} importieren`}
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
