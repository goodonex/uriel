import { useCallback, useEffect, useMemo, useState } from 'react'
import { addContactToList, findListIdsForContact, useContactLists } from '../../../hooks/useContactLists'
import { useBrandId } from '../../../hooks/useBrandId'
import type { Contact } from '../../../types/db'
import { useToast } from '../../Toast'

export function ContactListMenuItems({
  brandSlug,
  contact,
  onPicked,
}: {
  brandSlug: string
  contact: Contact
  onPicked?: () => void
}) {
  const { show } = useToast()
  const brandId = useBrandId(brandSlug)
  const { lists } = useContactLists(brandSlug)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const ids = await findListIdsForContact(brandSlug, brandId, contact)
    setMemberIds(ids)
  }, [brandSlug, brandId, contact])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const available = useMemo(
    () => lists.filter((l) => !memberIds.includes(l.id) && l.list_type !== 'dynamic'),
    [lists, memberIds],
  )

  const add = async (listId: string) => {
    setBusy(true)
    try {
      await addContactToList(brandSlug, listId, contact)
      await refresh()
      show('Zur Liste hinzugefügt', 'success')
      onPicked?.()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Fehler', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (available.length === 0) {
    return (
      <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '8px 10px' }}>
        Keine Listen verfügbar
      </p>
    )
  }

  return (
    <>
      {available.map((l) => (
        <button
          key={l.id}
          type="button"
          disabled={busy}
          className="font-mono"
          onClick={() => void add(l.id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            fontSize: 11,
            padding: '8px 10px',
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          📋 Zu Liste: {l.name}
        </button>
      ))}
    </>
  )
}
