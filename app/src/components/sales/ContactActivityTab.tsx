import { useMemo } from 'react'
import { useCallLogs, useEmailLogs } from '../../hooks/useSalesPro'
import { contactStatusMeta } from '../../lib/crmStatus'
import type { Contact } from '../../types/db'

export function ContactActivityTab({ brandSlug, contact }: { brandSlug: string; contact: Contact }) {
  const calls = useCallLogs(brandSlug, { contactId: contact.id })
  const mails = useEmailLogs(brandSlug, { contactId: contact.id })

  const items = useMemo(() => {
    const rows: { id: string; at: string; title: string; meta: string }[] = []
    for (const a of contact.activity_log ?? []) {
      rows.push({ id: `n:${a.id}`, at: a.at, title: a.text, meta: 'Notiz' })
    }
    for (const c of calls.items) {
      rows.push({
        id: `c:${c.id}`,
        at: c.called_at,
        title: c.notes || 'Anruf',
        meta: c.outcome,
      })
    }
    for (const m of mails.items) {
      rows.push({
        id: `m:${m.id}`,
        at: m.sent_at,
        title: m.subject || 'E-Mail',
        meta: m.direction === 'outbound' ? 'Gesendet' : 'Empfangen',
      })
    }
    for (const a of contact.activity_log ?? []) {
      if (a.text.startsWith('Status:')) {
        rows.push({ id: `s:${a.id}`, at: a.at, title: a.text, meta: 'Status' })
      }
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }, [calls.items, contact.activity_log, mails.items])

  return (
    <div className="flex max-w-3xl flex-col gap-2">
      {items.length === 0 ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Noch keine Aktivität.
        </p>
      ) : (
        items.map((it) => (
          <div
            key={it.id}
            className="rounded-xl px-4 py-3"
            style={{ border: '1px solid var(--glass-border-2)', background: 'var(--glass-1)' }}
          >
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {new Date(it.at).toLocaleString('de-DE')} · {it.meta}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{it.title}</div>
          </div>
        ))
      )}
      <p className="font-mono mt-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        Aktueller Status: {contactStatusMeta(contact.contact_status).label}
      </p>
    </div>
  )
}
