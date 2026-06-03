import { useMemo, useState } from 'react'
import { contactStatusMeta } from '../../lib/crmStatus'
import { companyDisplayName, isCompany } from '../../lib/crmContacts'
import { contactRowSubtitle } from '../../lib/crmFilters'
import type { Contact, PipelineStage } from '../../types/db'

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Pitch',
  deal: 'Deal',
  paused: 'Pause',
}

type SortKey = 'name' | 'person' | 'stage' | 'status' | 'last' | 'follow' | 'phone'

export function PipelineTableView({
  contacts,
  allContacts,
  onOpen,
}: {
  contacts: Contact[]
  allContacts: Contact[]
  onOpen: (id: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const rows = useMemo(() => {
    const companies = contacts.filter((c) => isCompany(c) || !c.parent_company_id)
    const sorted = [...companies].sort((a, b) => {
      let av = ''
      let bv = ''
      switch (sortKey) {
        case 'name':
          av = companyDisplayName(a)
          bv = companyDisplayName(b)
          break
        case 'person':
          av = contactRowSubtitle(a, allContacts)
          bv = contactRowSubtitle(b, allContacts)
          break
        case 'stage':
          av = STAGE_LABEL[a.pipeline_stage]
          bv = STAGE_LABEL[b.pipeline_stage]
          break
        case 'status':
          av = contactStatusMeta(a.contact_status).label
          bv = contactStatusMeta(b.contact_status).label
          break
        case 'last':
          av = a.last_contact_at ?? ''
          bv = b.last_contact_at ?? ''
          break
        case 'follow':
          av = a.next_follow_up_at ?? ''
          bv = b.next_follow_up_at ?? ''
          break
        case 'phone':
          av = a.phone
          bv = b.phone
          break
      }
      const cmp = av.localeCompare(bv, 'de')
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [allContacts, contacts, sortAsc, sortKey])

  const header = (key: SortKey, label: string) => (
    <th
      className="font-mono cursor-pointer px-3 py-2 text-left"
      style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
      onClick={() => {
        if (sortKey === key) setSortAsc((v) => !v)
        else {
          setSortKey(key)
          setSortAsc(true)
        }
      }}
    >
      {label}
      {sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--glass-border-1)' }}>
      <table className="w-full border-collapse font-mono" style={{ fontSize: 12 }}>
        <thead style={{ background: 'var(--glass-2)' }}>
          <tr>
            {header('name', 'Name/Firma')}
            {header('person', 'Ansprechpartner')}
            {header('stage', 'Phase')}
            {header('status', 'Status')}
            {header('last', 'Letzter Kontakt')}
            {header('follow', 'Nächster FU')}
            {header('phone', 'Telefon')}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const st = contactStatusMeta(c.contact_status)
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c.id)}
                style={{
                  cursor: 'pointer',
                  background: i % 2 === 0 ? 'var(--glass-1)' : 'color-mix(in srgb, var(--glass-2) 60%, transparent)',
                }}
              >
                <td className="px-3 py-2">{companyDisplayName(c)}</td>
                <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                  {contactRowSubtitle(c, allContacts)}
                </td>
                <td className="px-3 py-2">{STAGE_LABEL[c.pipeline_stage]}</td>
                <td className="px-3 py-2" style={{ color: st.color }}>
                  {st.label}
                </td>
                <td className="px-3 py-2">
                  {c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString('de-DE') : '—'}
                </td>
                <td className="px-3 py-2">
                  {c.next_follow_up_at ? new Date(c.next_follow_up_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-3 py-2">
                  {c.phone ? (
                    <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>
                      {c.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
