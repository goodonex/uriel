import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useActivityEntries } from '../../hooks/useActivityEntries'
import { useContacts } from '../../hooks/useContacts'
import { parseCsv } from '../../lib/csvParse'
import { similarityPercent } from '../../lib/levenshtein'
import type { ContactStatus } from '../../types/db'
import { useToast } from '../Toast'

interface SalesImportDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
}

type FieldKey =
  | 'firma'
  | 'ansprechpartner'
  | 'phone'
  | 'website'
  | 'standort'
  | 'aufhaenger'
  | 'status'
  | 'skip'

const FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: 'skip', label: '— Nicht importieren —' },
  { key: 'firma', label: 'Firma' },
  { key: 'ansprechpartner', label: 'Ansprechpartner' },
  { key: 'phone', label: 'Telefon (Kontakt)' },
  { key: 'website', label: 'Website' },
  { key: 'standort', label: 'Standort' },
  { key: 'aufhaenger', label: 'Aufhänger (Notiz)' },
  { key: 'status', label: 'Status' },
]

const STATUS_MAP: Record<string, ContactStatus> = {
  nichtkontaktiert: 'not_contacted',
  notcontacted: 'not_contacted',
  nichterreicht: 'not_reached',
  notreached: 'not_reached',
  inkontakt: 'in_contact',
  incontact: 'in_contact',
  highpotential: 'high_potential',
  followupgeplant: 'followup_planned',
  followupplanned: 'followup_planned',
  angebotgemacht: 'offer_made',
  offermade: 'offer_made',
  unqualifiziert: 'unqualified',
  unqualified: 'unqualified',
  dealgewonnen: 'deal_won',
  dealwon: 'deal_won',
  dealverloren: 'deal_lost',
  deallost: 'deal_lost',
}

function normalizeStatusKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function autoMap(header: string): FieldKey {
  const h = header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (
    h.includes('firma') ||
    h.includes('unternehmen') ||
    h === 'company' ||
    h.includes('firmenname')
  ) {
    return 'firma'
  }
  if (h.includes('ansprech') || h.includes('kontaktperson')) return 'ansprechpartner'
  if (h.includes('telefon') || h.includes('tel') || h === 'phone' || h.includes('mobil')) {
    return 'phone'
  }
  if (h.includes('website') || h === 'url' || h.includes('webseite')) return 'website'
  if (h.includes('standort') || h === 'ort' || h.includes('stadt') || h.includes('city')) {
    return 'standort'
  }
  if (h.includes('aufha') || h.includes('notiz') || h.includes('note') || h.includes('hook')) {
    return 'aufhaenger'
  }
  if (h.includes('status')) return 'status'
  return 'skip'
}

export function SalesImportDrawer({ open, onClose, brandSlug }: SalesImportDrawerProps) {
  const contacts = useContacts(brandSlug)
  const activityEntries = useActivityEntries(brandSlug)
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
    const parsed = parseCsv(text)
    setRows(parsed)
    if (parsed.length > 0) {
      const header = parsed[0]
      setMapping(header.map((h) => autoMap(h)))
    }
  }

  const dataRows = useMemo(() => (hasHeader ? rows.slice(1) : rows), [rows, hasHeader])

  const validCount = useMemo(() => {
    const companyIdx = mapping.indexOf('firma')
    if (companyIdx < 0) return 0
    return dataRows.filter((r) => {
      const company = (r[companyIdx] ?? '').trim()
      return company.length > 0
    }).length
  }, [dataRows, mapping])

  const handleImport = async () => {
    if (validCount === 0) {
      show('Keine importierbaren Zeilen', 'info')
      return
    }
    setBusy(true)
    let success = 0
    let skipped = 0
    let errors = 0
    const knownCompanies = contacts.items
      .filter((c) => c.contact_type === 'company')
      .map((c) => (c.name || c.company || '').trim())
      .filter(Boolean)

    for (const row of dataRows) {
      const parsed: Partial<Record<FieldKey, string>> = {}
      mapping.forEach((key, idx) => {
        const raw = (row[idx] ?? '').trim()
        if (!raw || key === 'skip') return
        parsed[key] = raw
      })

      const companyName = (parsed.firma ?? '').trim()
      if (!companyName) continue

      let duplicate = false
      for (const existingName of knownCompanies) {
        if (similarityPercent(companyName, existingName) > 80) {
          duplicate = true
          break
        }
      }
      if (duplicate) {
        skipped++
        continue
      }

      const normalizedStatus = normalizeStatusKey(parsed.status ?? '')
      const mappedStatus = STATUS_MAP[normalizedStatus] ?? 'not_contacted'
      const personName = (parsed.ansprechpartner ?? '').trim()
      const [firstName = '', ...lastNameParts] = personName.split(/\s+/).filter(Boolean)
      const lastName = lastNameParts.join(' ')

      try {
        const companyCreate = await contacts.create(
          {
            contact_type: 'company',
            name: companyName,
            company: companyName,
            website: (parsed.website ?? '').trim(),
            address: (parsed.standort ?? '').trim(),
            contact_status: mappedStatus,
            pipeline_stage: 'first_contact',
          },
          { skipDuplicateCheck: true },
        )

        if (!companyCreate.ok) {
          skipped++
          continue
        }

        const personCreate = await contacts.create(
          {
            contact_type: 'person',
            parent_company_id: companyCreate.contact.id,
            first_name: firstName,
            last_name: lastName,
            name: personName || 'Ansprechpartner',
            phone: (parsed.phone ?? '').trim(),
            company: companyName,
            contact_status: mappedStatus,
            pipeline_stage: 'first_contact',
          },
          { skipDuplicateCheck: true },
        )

        if (!personCreate.ok) {
          errors++
          continue
        }

        const note = (parsed.aufhaenger ?? '').trim()
        if (note) {
          await activityEntries.create({
            contact_id: companyCreate.contact.id,
            activity_type: 'notiz',
            data: { text: note },
          })
        }

        knownCompanies.push(companyName)
        success++
      } catch {
        errors++
      }
    }
    setBusy(false)
    show(
      `Import abgeschlossen: ${success} importiert, ${skipped} übersprungen, ${errors} Fehler`,
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
          style={{ background: 'var(--overlay-backdrop)', backdropFilter: 'blur(8px)' }}
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
              background: 'var(--surface-drawer)',
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
                    placeholder="firma,ansprechpartner,telefon,website,standort,aufhaenger,status\nMuster GmbH,Max Mustermann,+49...,https://...,Berlin,Warmer Lead,nicht kontaktiert"
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
