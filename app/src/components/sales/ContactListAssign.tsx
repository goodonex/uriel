import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addContactToList,
  findListIdsForContact,
  useContactLists,
} from '../../hooks/useContactLists'
import { useBrandId } from '../../hooks/useBrandId'
import type { Contact } from '../../types/db'
import { useToast } from '../Toast'

const QUICK_LISTS: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'Gerade gesprochen', description: 'Heute kontaktiert' },
  { name: 'High Potentials', description: 'Warm — Batch anrufen' },
  { name: 'Follow-up Batch', description: 'Später nachfassen' },
]

export function ContactListAssign({
  brandSlug,
  contact,
}: {
  brandSlug: string
  contact: Contact
}) {
  const { show } = useToast()
  const brandId = useBrandId(brandSlug)
  const { lists, createList } = useContactLists(brandSlug)
  const [memberListIds, setMemberListIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [pickListId, setPickListId] = useState('')

  const emailKey = (contact.email ?? '').trim().toLowerCase()

  const refreshMembership = useCallback(async () => {
    const ids = await findListIdsForContact(brandSlug, brandId, contact)
    setMemberListIds(ids)
  }, [brandSlug, brandId, contact])

  useEffect(() => {
    void refreshMembership()
  }, [refreshMembership])

  const memberLists = useMemo(
    () => lists.filter((l) => memberListIds.includes(l.id)),
    [lists, memberListIds],
  )

  const addToList = useCallback(
    async (listId: string) => {
      setBusy(true)
      try {
        await addContactToList(brandSlug, listId, contact)
        await refreshMembership()
        show('Zur Liste hinzugefügt', 'success')
        setPickListId('')
      } catch (e) {
        show(e instanceof Error ? e.message : 'Konnte nicht hinzufügen', 'error')
      } finally {
        setBusy(false)
      }
    },
    [brandSlug, contact, refreshMembership, show],
  )

  const quickCreateAndAdd = useCallback(
    async (name: string, description: string) => {
      setBusy(true)
      try {
        const id = await createList({ name, description })
        await addContactToList(brandSlug, id, contact)
        await refreshMembership()
        show(`Liste „${name}" erstellt`, 'success')
      } catch (e) {
        show(e instanceof Error ? e.message : 'Fehler', 'error')
      } finally {
        setBusy(false)
      }
    },
    [brandSlug, contact, createList, refreshMembership, show],
  )

  return (
    <div
      className="rounded-2xl p-3"
      style={{
        border: '1px solid color-mix(in srgb, var(--mode-sales) 28%, var(--glass-border-2))',
        background: 'color-mix(in srgb, var(--mode-sales) 6%, var(--glass-1))',
      }}
    >
      <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--mode-sales)' }}>
        Listen · Batch-Calling
      </div>

      {memberLists.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {memberLists.map((l) => (
            <Link
              key={l.id}
              to={`/brand/${brandSlug}/sales/lists/${l.id}`}
              className="font-mono rounded-md px-2 py-0.5"
              style={{
                fontSize: 9,
                textDecoration: 'none',
                color: 'var(--mode-sales)',
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
              }}
            >
              {l.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {emailKey ? 'Noch in keiner Liste.' : 'E-Mail eintragen für Listen-Zuordnung.'}
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-1">
        {QUICK_LISTS.map((q) => (
          <button
            key={q.name}
            type="button"
            disabled={busy || !emailKey}
            title={q.description}
            className="font-mono rounded-md px-2 py-1"
            style={{
              fontSize: 9,
              letterSpacing: '0.04em',
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-secondary)',
              cursor: busy || !emailKey ? 'not-allowed' : 'pointer',
              opacity: !emailKey ? 0.5 : 1,
            }}
            onClick={() => void quickCreateAndAdd(q.name, q.description)}
          >
            + {q.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={pickListId}
          disabled={busy || lists.length === 0}
          onChange={(e) => setPickListId(e.target.value)}
          className="font-mono min-w-0 flex-1 rounded-lg px-2 py-1.5"
          style={{
            fontSize: 11,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-1)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">Bestehende Liste…</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id} disabled={memberListIds.includes(l.id)}>
              {l.name}
              {memberListIds.includes(l.id) ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !pickListId}
          className="font-mono shrink-0 rounded-lg px-2.5 py-1.5"
          style={{
            fontSize: 10,
            border: '1px solid var(--mode-sales)',
            color: 'var(--mode-sales)',
            background: 'transparent',
            cursor: !pickListId ? 'not-allowed' : 'pointer',
            opacity: !pickListId ? 0.5 : 1,
          }}
          onClick={() => void addToList(pickListId)}
        >
          Hinzufügen
        </button>
      </div>
    </div>
  )
}
