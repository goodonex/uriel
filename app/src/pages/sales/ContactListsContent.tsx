import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { LIST_PRESETS, useContactListItems, useContactLists } from '../../hooks/useContactLists'
import { ContactListCardMenu } from '../../components/sales/ContactListCardMenu'
import { useSalesQuickLead } from '../../components/sales/SalesLeadCapture'
import { useContacts } from '../../hooks/useContacts'
import { supabase } from '../../lib/supabase'
import type { ContactListItemStatus } from '../../types/db'

const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
} as const

const STATUS_OPTIONS: { value: ContactListItemStatus; label: string }[] = [
  { value: 'offen', label: 'Offen' },
  { value: 'angerufen', label: 'Angerufen' },
  { value: 'kein_interesse', label: 'Kein Interesse' },
  { value: 'in_pipeline', label: 'In Pipeline' },
]

const DAILY_CALL_QUOTA = 30

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return []
  const delim =
    lines[0].split(';').length > lines[0].split(',').length ? ';' : ','
  return lines.map((line) =>
    line.split(delim).map((c) => c.trim().replace(/^"|"$/g, '')),
  )
}

type MapKey = 'name' | 'email' | 'phone' | 'company' | 'linkedin' | 'skip'

const MAP_LABEL: Record<MapKey, string> = {
  name: 'Name',
  email: 'E-Mail',
  phone: 'Telefon',
  company: 'Firma',
  linkedin: 'LinkedIn',
  skip: '— ignorieren —',
}

export function ContactListsContent({
  slug,
  listId,
  embedded = false,
}: {
  slug: string
  listId?: string
  embedded?: boolean
}) {
  const navigate = useNavigate()
  const { show } = useToast()
  const listsBase = `/brand/${slug}/sales/lists`
  const overviewBackTo = embedded ? `/brand/${slug}/sales?tab=listen` : `/brand/${slug}/sales`

  const {
    lists,
    loading: listsLoading,
    error: listsErr,
    createList,
    updateListMeta,
    deleteList,
    reload: reloadLists,
  } = useContactLists(slug)
  const {
    items,
    loading: itemsLoading,
    error: itemsErr,
    insertRows,
    updateItem,
  } = useContactListItems(listId, slug)
  const contacts = useContacts(slug)
  const quickLead = useSalesQuickLead(slug)

  const existingEmailsLower = useMemo(() => {
    const s = new Set<string>()
    for (const c of contacts.items) {
      const e = (c.email ?? '').trim().toLowerCase()
      if (e) s.add(e)
    }
    return s
  }, [contacts.items])

  const activeList = useMemo(
    () => lists.find((l) => l.id === listId) ?? null,
    [lists, listId],
  )

  const [newListName, setNewListName] = useState('')
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListName, setEditingListName] = useState('')
  const [showHiddenLists, setShowHiddenLists] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | ContactListItemStatus>('all')
  const [search, setSearch] = useState('')

  const hiddenListCount = useMemo(() => lists.filter((l) => l.is_hidden).length, [lists])

  const visibleLists = useMemo(() => {
    const base = showHiddenLists ? lists : lists.filter((l) => !l.is_hidden)
    return [...base].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
      return b.created_at.localeCompare(a.created_at)
    })
  }, [lists, showHiddenLists])

  const handleToggleFavorite = useCallback(
    async (list: (typeof lists)[0]) => {
      try {
        await updateListMeta(list.id, { is_favorite: !list.is_favorite })
        show(
          list.is_favorite ? 'Aus Favoriten entfernt' : 'Als Favorit markiert',
          'success',
        )
      } catch (e) {
        show(e instanceof Error ? e.message : 'Aktion fehlgeschlagen', 'error')
      }
    },
    [show, updateListMeta],
  )

  const handleToggleHidden = useCallback(
    async (list: (typeof lists)[0]) => {
      try {
        await updateListMeta(list.id, { is_hidden: !list.is_hidden })
        show(list.is_hidden ? 'Liste wieder sichtbar' : 'Liste ausgeblendet', 'success')
      } catch (e) {
        show(e instanceof Error ? e.message : 'Aktion fehlgeschlagen', 'error')
      }
    },
    [show, updateListMeta],
  )

  const handleDeleteList = useCallback(
    async (list: (typeof lists)[0]) => {
      if (
        !window.confirm(
          `Liste „${list.name}" wirklich löschen? Alle Einträge in dieser Liste gehen verloren.`,
        )
      ) {
        return
      }
      try {
        await deleteList(list.id)
        if (listId === list.id) navigate(overviewBackTo)
        show('Liste gelöscht', 'success')
      } catch (e) {
        show(e instanceof Error ? e.message : 'Löschen fehlgeschlagen', 'error')
      }
    },
    [deleteList, listId, navigate, overviewBackTo, show],
  )

  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [colMap, setColMap] = useState<Record<string, MapKey>>({})
  const [csvBusy, setCsvBusy] = useState(false)
  const [skipImportDupes, setSkipImportDupes] = useState(false)

  const emailForMappedCsvRow = useCallback(
    (row: string[]) => {
      let out = ''
      csvHeaders.forEach((h, idx) => {
        const key = colMap[h] ?? 'skip'
        if (key === 'email') out = (row[idx] ?? '').trim().toLowerCase()
      })
      return out
    },
    [colMap, csvHeaders],
  )

  const previewRowDupFlags = useMemo(() => {
    return csvRows.slice(0, 3).map((r) => {
      const em = emailForMappedCsvRow(r)
      return Boolean(em && existingEmailsLower.has(em))
    })
  }, [csvRows, emailForMappedCsvRow, existingEmailsLower])

  const [listStats, setListStats] = useState<
    Record<string, { total: number; called: number; calledToday: number }>
  >({})

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      if (!slug || lists.length === 0) {
        setListStats({})
        return
      }
      const ids = lists.map((l) => l.id)
      if (!supabase) {
        setListStats({})
        return
      }
      const { data, error } = await supabase
        .from('contact_list_items')
        .select('list_id,status,called_at')
        .in('list_id', ids)

      if (cancelled || error || !data) {
        if (!cancelled) setListStats({})
        return
      }
      const today = startOfToday().getTime()
      const next: Record<string, { total: number; called: number; calledToday: number }> = {}
      for (const id of ids) {
        next[id] = { total: 0, called: 0, calledToday: 0 }
      }
      for (const row of data as { list_id: string; status: string; called_at: string | null }[]) {
        const b = next[row.list_id]
        if (!b) continue
        b.total += 1
        if (row.status === 'angerufen') b.called += 1
        if (row.called_at && new Date(row.called_at).getTime() >= today) b.calledToday += 1
      }
      setListStats(next)
    }
    void loadStats()
    return () => {
      cancelled = true
    }
  }, [slug, lists])

  const calledTodayForList = useMemo(() => {
    if (!listId) return 0
    const t0 = startOfToday().getTime()
    return items.filter((i) => i.called_at && new Date(i.called_at).getTime() >= t0).length
  }, [items, listId])

  const filteredItems = useMemo(() => {
    let rows = items
    if (filterStatus !== 'all') rows = rows.filter((i) => i.status === filterStatus)
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (i) =>
          (i.name ?? '').toLowerCase().includes(q) ||
          (i.company ?? '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [items, filterStatus, search])

  const onCreateList = useCallback(async () => {
    if (!slug) return
    const name = newListName.trim() || 'Neue Liste'
    try {
      const id = await createList({ name })
      setNewListName('')
      navigate(`${listsBase}/${id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Liste konnte nicht angelegt werden.'
      show(msg, 'error')
    }
  }, [createList, listsBase, navigate, newListName, show, slug])

  const onCsvFile = useCallback((file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const grid = parseCsv(text)
      if (grid.length < 2) {
        setCsvHeaders([])
        setCsvRows([])
        return
      }
      const headers = grid[0].map((h, i) => h || `Spalte ${i + 1}`)
      const initMap: Record<string, MapKey> = {}
      for (const h of headers) initMap[h] = 'skip'
      const lower = (s: string) => s.toLowerCase()
      for (const h of headers) {
        const L = lower(h)
        if (L.includes('name') || L.includes('vorname')) initMap[h] = 'name'
        else if (L.includes('mail')) initMap[h] = 'email'
        else if (L.includes('tel') || L.includes('phone')) initMap[h] = 'phone'
        else if (L.includes('firma') || L.includes('company')) initMap[h] = 'company'
        else if (L.includes('linkedin')) initMap[h] = 'linkedin'
      }
      setColMap(initMap)
      setCsvHeaders(headers)
      setCsvRows(grid.slice(1))
    }
    reader.readAsText(file)
  }, [])

  const previewRows = csvRows.slice(0, 3)

  const runImport = useCallback(async () => {
    if (!listId || csvRows.length === 0) return
    setCsvBusy(true)
    try {
      const out: Array<{
        name?: string
        email?: string
        phone?: string
        company?: string
        linkedin_url?: string
      }> = []
      for (const row of csvRows) {
        const o: Record<string, string> = {}
        csvHeaders.forEach((h, idx) => {
          const key = colMap[h] ?? 'skip'
          if (key === 'skip') return
          const cell = row[idx] ?? ''
          if (key === 'linkedin') o.linkedin_url = cell
          else o[key] = cell
        })
        out.push({
          name: o.name,
          email: o.email,
          phone: o.phone,
          company: o.company,
          linkedin_url: o.linkedin_url,
        })
      }
      const toInsert = skipImportDupes
        ? out.filter((o) => {
            const e = (o.email ?? '').trim().toLowerCase()
            return !e || !existingEmailsLower.has(e)
          })
        : out
      await insertRows(toInsert)
      setCsvHeaders([])
      setCsvRows([])
      await reloadLists()
    } catch (e) {
      console.error(e)
    } finally {
      setCsvBusy(false)
    }
  }, [colMap, csvHeaders, csvRows, existingEmailsLower, insertRows, listId, reloadLists, skipImportDupes])

  const telHref = (phone: string) => {
    const d = phone.replace(/[^\d+]/g, '')
    return d ? `tel:${d}` : ''
  }

  const pushToPipeline = useCallback(
    async (row: (typeof items)[0]) => {
      if (!slug) return
      const r = await contacts.create({
        name: row.name || 'Lead',
        email: row.email ?? '',
        phone: row.phone ?? '',
        company: row.company ?? '',
        linkedin: row.linkedin_url ?? '',
        pipeline_stage: 'first_contact',
        notes: row.notes ?? '',
      })
      const contact = r.ok ? r.contact : r.duplicate
      await updateItem(row.id, {
        status: 'in_pipeline',
        called_at: row.called_at ?? new Date().toISOString(),
      })
      navigate(`/brand/${slug}/sales/${contact.id}`)
    },
    [contacts, navigate, slug, updateItem],
  )

  const newListInputId = embedded ? 'contact-list-new-name-embedded' : 'contact-list-new-name'

  if (!listId) {
    return (
      <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: 'auto', background: 'transparent' }}
      >
        {embedded ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--mode-sales)' }}>
              Kontakt-Listen
            </div>
            <quickLead.ActionBar compact />
          </div>
        ) : (
          <>
            <div className="mb-2 font-mono" style={{ fontSize: 10, color: 'var(--mode-sales)' }}>
              Sales · Listen
            </div>
            <h1 className="font-display mb-6" style={{ fontSize: 22, fontWeight: 600 }}>
              Kontakt-Listen
            </h1>
          </>
        )}

        {listsErr ? (
          <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
            {listsErr}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {LIST_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onClick={async () => {
                try {
                  const id = await createList({
                    name: preset.name,
                    description: preset.description,
                  })
                  navigate(`${listsBase}/${id}`)
                } catch (e) {
                  show(e instanceof Error ? e.message : 'Liste konnte nicht angelegt werden.', 'error')
                }
              }}
            >
              + {preset.name}
            </button>
          ))}
        </div>

        <div
          className="glass-2 mb-8 flex flex-wrap items-end gap-3 rounded-2xl p-4"
          style={{ border: '1px solid var(--glass-border-1)' }}
        >
          <div className="min-w-0 flex-1" style={{ flex: '1 1 220px' }}>
            <label
              htmlFor={newListInputId}
              className="font-mono mb-1 block"
              style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
            >
              Listenname
            </label>
            <input
              id={newListInputId}
              type="text"
              name="contact_list_name"
              autoComplete="off"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="z. B. Messe Q2"
              style={{
                ...FIELD,
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            type="button"
            className="font-mono"
            onClick={() => void onCreateList()}
            style={{
              fontSize: 11,
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid var(--accent-teal)',
              background: 'color-mix(in srgb, var(--accent-teal) 14%, transparent)',
              color: 'var(--accent-teal)',
            }}
          >
            + Neue Liste
          </button>
        </div>

        {hiddenListCount > 0 ? (
          <div className="mb-4">
            <button
              type="button"
              className="font-mono"
              onClick={() => setShowHiddenLists((v) => !v)}
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--glass-border-2)',
                background: showHiddenLists ? 'var(--glass-3)' : 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {showHiddenLists
                ? 'Ausgeblendete verbergen'
                : `Ausgeblendete anzeigen (${hiddenListCount})`}
            </button>
          </div>
        ) : null}

        {listsLoading ? (
          <div
            className="animate-pulse rounded-2xl"
            style={{ height: 120, background: 'var(--glass-2)' }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleLists.map((l) => {
              const st = listStats[l.id] ?? { total: 0, called: 0, calledToday: 0 }
              const pct = st.total ? Math.round((st.called / st.total) * 100) : 0
              return (
                <div
                  key={l.id}
                  className="glass-2 relative rounded-2xl transition-opacity hover:opacity-95"
                  style={{
                    border: l.is_favorite
                      ? '1px solid color-mix(in srgb, var(--mode-sales) 55%, var(--glass-border-1))'
                      : '1px solid var(--glass-border-1)',
                    opacity: l.is_hidden ? 0.72 : 1,
                  }}
                >
                  <ContactListCardMenu
                    list={l}
                    onToggleFavorite={() => void handleToggleFavorite(l)}
                    onToggleHidden={() => void handleToggleHidden(l)}
                    onDelete={() => void handleDeleteList(l)}
                  />
                  <Link
                    to={`${listsBase}/${l.id}`}
                    className="block rounded-2xl p-4 pr-12"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="flex items-start gap-2">
                      {l.is_favorite ? (
                        <span
                          className="font-mono shrink-0"
                          style={{ fontSize: 12, color: 'var(--mode-sales)' }}
                          title="Favorit"
                        >
                          ★
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        {editingListId === l.id ? (
                          <input
                            value={editingListName}
                            onChange={(e) => setEditingListName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                void updateListMeta(l.id, { name: editingListName.trim() || l.name }).then(() =>
                                  setEditingListId(null),
                                )
                              }
                              if (e.key === 'Escape') setEditingListId(null)
                            }}
                            onBlur={() => {
                              void updateListMeta(l.id, { name: editingListName.trim() || l.name }).then(() =>
                                setEditingListId(null),
                              )
                            }}
                            className="font-display w-full"
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              background: 'var(--glass-1)',
                              border: '1px solid var(--mode-sales)',
                              borderRadius: 6,
                              padding: '2px 6px',
                              color: 'var(--text-primary)',
                            }}
                            autoFocus
                            onClick={(e) => e.preventDefault()}
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <div
                              className="font-display"
                              style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
                            >
                              {l.name}
                            </div>
                            <button
                              type="button"
                              title="Name bearbeiten"
                              onClick={(e) => {
                                e.preventDefault()
                                setEditingListId(l.id)
                                setEditingListName(l.name)
                              }}
                              className="font-mono"
                              style={{
                                fontSize: 10,
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-tertiary)',
                                cursor: 'pointer',
                              }}
                            >
                              ✎
                            </button>
                          </div>
                        )}
                        {l.description ? (
                          <div
                            className="mt-1"
                            style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                          >
                            {l.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className="mt-3 flex flex-wrap gap-3 font-mono"
                      style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                    >
                      <span>{st.total} Einträge</span>
                      <span>
                        {st.called} angerufen ({pct}%)
                      </span>
                      {l.is_hidden ? <span>· ausgeblendet</span> : null}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {!listsLoading && visibleLists.length === 0 ? (
          <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Noch keine Liste — leg oben eine an oder importiere CSV in der Detailansicht.
          </p>
        ) : null}

        {!embedded ? (
          <div className="mt-8">
            <Link to={overviewBackTo} className="font-mono" style={{ fontSize: 11, color: 'var(--mode-sales)' }}>
              ← Zur Pipeline
            </Link>
          </div>
        ) : null}
      </motion.div>
      <quickLead.DrawerEl />
      <quickLead.DupModalEl />
      </>
    )
  }

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to={embedded ? overviewBackTo : listsBase}
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--mode-sales)', textDecoration: 'none' }}
          >
            ← Alle Listen
          </Link>
          <h1 className="font-display mt-2" style={{ fontSize: 22, fontWeight: 600 }}>
            {activeList?.name ?? 'Liste'}
          </h1>
          {activeList?.description ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              {activeList.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <quickLead.ActionBar compact />
        {listId ? (
          <Link
            to={`/brand/${slug}/sales/call-mode?source=list&listId=${encodeURIComponent(listId)}`}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--mode-sales)',
              textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            📞 Call Mode
          </Link>
        ) : null}
        </div>
      </div>

      {itemsErr ? (
        <p className="font-mono mb-4" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {itemsErr}
        </p>
      ) : null}

      <div
        className="glass-2 mb-6 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)' }}
      >
        <div className="mb-2 font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          Heute angerufen (Zeitstempel)
        </div>
        <div className="font-display mb-1" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
          {calledTodayForList} / {DAILY_CALL_QUOTA}
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 4,
            background: 'var(--glass-3)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, (calledTodayForList / DAILY_CALL_QUOTA) * 100)}%`,
              height: '100%',
              background: 'var(--accent-teal)',
              opacity: 0.85,
            }}
          />
        </div>
      </div>

      <div
        className="glass-2 mb-8 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)' }}
      >
        <div className="mb-3 font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          CSV importieren
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mb-3 font-mono"
          style={{ fontSize: 11 }}
          onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
        />
        {csvHeaders.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {csvHeaders.map((h) => (
                <label key={h} className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{h}</span>
                  <select
                    value={colMap[h] ?? 'skip'}
                    onChange={(e) =>
                      setColMap((m) => ({ ...m, [h]: e.target.value as MapKey }))
                    }
                    style={FIELD}
                  >
                    {(Object.keys(MAP_LABEL) as MapKey[]).map((k) => (
                      <option key={k} value={k}>
                        {MAP_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Vorschau (erste 3 Zeilen)
            </div>
            <label className="font-mono flex cursor-pointer items-center gap-2" style={{ fontSize: 10 }}>
              <input
                type="checkbox"
                checked={skipImportDupes}
                onChange={(e) => setSkipImportDupes(e.target.checked)}
                style={{ accentColor: 'var(--mode-sales)' }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>Duplikate beim Import überspringen (gleiche E-Mail)</span>
            </label>
            <div
              className="overflow-x-auto rounded-xl"
              style={{ border: '1px solid var(--glass-border-2)' }}
            >
              <table className="w-full text-left font-mono" style={{ fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ padding: 8, color: 'var(--text-tertiary)' }}>Match</th>
                    {csvHeaders.map((h) => (
                      <th key={h} style={{ padding: 8, color: 'var(--text-tertiary)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: 8, verticalAlign: 'top' }}>
                        {previewRowDupFlags[i] ? (
                          <span
                            style={{
                              fontSize: 8,
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: 'color-mix(in srgb, var(--accent-amber) 22%, transparent)',
                              border: '1px solid var(--accent-amber)',
                              color: 'var(--accent-amber)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Duplikat möglich
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                      {csvHeaders.map((_, j) => (
                        <td key={j} style={{ padding: 8, color: 'var(--text-secondary)' }}>
                          {r[j] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="font-mono"
              disabled={csvBusy}
              onClick={() => void runImport()}
              style={{
                alignSelf: 'flex-start',
                fontSize: 11,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid var(--accent-teal)',
                color: 'var(--accent-teal)',
                background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                opacity: csvBusy ? 0.6 : 1,
              }}
            >
              Importieren ({csvRows.length} Zeilen)
            </button>
          </div>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Suche Name / Firma…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...FIELD, maxWidth: 280 }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          style={{ ...FIELD, maxWidth: 200 }}
        >
          <option value="all">Alle</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {itemsLoading ? (
        <div
          className="animate-pulse rounded-2xl"
          style={{ height: 200, background: 'var(--glass-2)' }}
        />
      ) : (
        <div
          className="overflow-x-auto rounded-2xl"
          style={{ border: '1px solid var(--glass-border-1)' }}
        >
          <table className="w-full text-left" style={{ fontSize: 13 }}>
            <thead className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              <tr>
                <th style={{ padding: 12 }}>Name</th>
                <th style={{ padding: 12 }}>Firma</th>
                <th style={{ padding: 12 }}>Telefon</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Notiz</th>
                <th style={{ padding: 12 }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--glass-border-1)' }}>
                  <td style={{ padding: 12, color: 'var(--text-primary)' }}>{row.name}</td>
                  <td style={{ padding: 12 }}>{row.company}</td>
                  <td style={{ padding: 12 }}>
                    {telHref(row.phone) ? (
                      <a href={telHref(row.phone)} style={{ color: 'var(--accent-blue)' }}>
                        {row.phone}
                      </a>
                    ) : (
                      row.phone
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    <select
                      value={row.status}
                      onChange={(e) => {
                        const st = e.target.value as ContactListItemStatus
                        void updateItem(row.id, {
                          status: st,
                          called_at:
                            st === 'angerufen' ? new Date().toISOString() : row.called_at,
                        })
                      }}
                      style={{ ...FIELD, fontSize: 11 }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 12, minWidth: 160 }}>
                    <input
                      type="text"
                      defaultValue={row.notes}
                      onBlur={(e) => {
                        if (e.target.value !== row.notes) {
                          void updateItem(row.id, { notes: e.target.value })
                        }
                      }}
                      style={{ ...FIELD, fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: 12 }}>
                    <button
                      type="button"
                      className="font-mono"
                      onClick={() => void pushToPipeline(row)}
                      style={{
                        fontSize: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--mode-sales)',
                        color: 'var(--mode-sales)',
                        background: 'transparent',
                      }}
                    >
                      In Pipeline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
    <quickLead.DrawerEl />
    <quickLead.DupModalEl />
    </>
  )
}
