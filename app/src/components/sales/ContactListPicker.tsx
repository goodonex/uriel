import { useCallback, useEffect, useMemo, useState } from 'react'
import { addContactToList, findListIdsForContact, useContactLists } from '../../hooks/useContactLists'
import { useBrandId } from '../../hooks/useBrandId'
import type { Contact } from '../../types/db'
import { useToast } from '../Toast'

export function ContactListPicker({ brandSlug, contact }: { brandSlug: string; contact: Contact }) {
  const { show } = useToast()
  const brandId = useBrandId(brandSlug)
  const { lists } = useContactLists(brandSlug)
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    } catch (e) {
      show(e instanceof Error ? e.message : 'Fehler', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="font-mono"
        style={{
          fontSize: 11,
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
          color: 'var(--mode-sales)',
          cursor: 'pointer',
        }}
      >
        Zu Liste hinzufügen ▾
      </button>
      {open ? (
        <div
          className="glass-2 font-mono"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            zIndex: 30,
            minWidth: 200,
            borderRadius: 10,
            border: '1px solid var(--glass-border-1)',
            padding: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {available.length === 0 ? (
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 8 }}>Keine Listen verfügbar</p>
          ) : (
            available.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => void add(l.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  fontSize: 11,
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  borderRadius: 6,
                }}
              >
                {l.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
