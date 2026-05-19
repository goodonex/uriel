import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { contactDisplayName } from '../../lib/crmContacts'
import type { Contact } from '../../types/db'

export function TopReferrersPanel({
  slug,
  contacts,
}: {
  slug: string
  contacts: Contact[]
}) {
  const rows = useMemo(() => {
    const byReferrer = new Map<
      string,
      { referrer: Contact; total: number; converted: number }
    >()

    for (const c of contacts) {
      if (!c.referred_by_id) continue
      const ref = contacts.find((x) => x.id === c.referred_by_id)
      if (!ref) continue
      const cur = byReferrer.get(ref.id) ?? { referrer: ref, total: 0, converted: 0 }
      cur.total += 1
      if (c.pipeline_stage === 'deal') cur.converted += 1
      byReferrer.set(ref.id, cur)
    }

    return Array.from(byReferrer.values()).sort((a, b) => b.total - a.total)
  }, [contacts])

  if (rows.length === 0) {
    return (
      <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Noch keine Empfehlungen erfasst.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li
          key={r.referrer.id}
          className="glass-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
          style={{ border: '1px solid var(--glass-border-1)' }}
        >
          <Link
            to={`/brand/${slug}/sales/${r.referrer.id}`}
            className="font-mono"
            style={{ fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 600 }}
          >
            {contactDisplayName(r.referrer)}
          </Link>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {r.total} Empfehlung{r.total === 1 ? '' : 'en'} · {r.converted} konvertiert
          </span>
        </li>
      ))}
    </ul>
  )
}
