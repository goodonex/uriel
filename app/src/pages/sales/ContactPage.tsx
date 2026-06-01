import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { findDeliverProjectForContact } from '../../components/sales/ContactDeliverCard'
import { ContactOverviewPanel } from '../../components/sales/ContactOverviewPanel'
import { ContactPhaseHeader } from '../../components/sales/ContactPhaseHeader'
import { ContactActivityActionBar } from '../../components/sales/activity/ContactActivityActionBar'
import { ActivityModalHost } from '../../components/sales/activity/ActivityModalHost'
import { EmailComposeDialog } from '../../components/sales/EmailComposeDialog'
import type { ActivityModalType } from '../../lib/activityTypes'
import { useCallLogs } from '../../hooks/useSalesPro'
import { useViewport } from '../../hooks/useViewport'
import { useContactScrollLock } from '../../hooks/useContactScrollLock'
import { useContactFieldConfig } from '../../hooks/useContactFieldConfig'
import { readContactsLocal, useContacts } from '../../hooks/useContacts'
import { useContactFieldSave } from '../../hooks/useContactFieldSave'
import { ContactSaveStatusIndicator } from '../../components/sales/ContactSaveStatusIndicator'
import { ContactBccHint } from '../../components/sales/ContactBccHint'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import type { ActivityEntry, Contact, SalesFieldItem } from '../../types/db'
const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
} as const

export function ContactPage({ variant = 'page' }: { variant?: 'page' | 'module' } = {}) {
  const { slug, contactId } = useParams<{ slug: string; contactId: string }>()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)
  const fieldCfgErst = useContactFieldConfig(slug, 'erstgespraech')
  const fieldCfgQual = useContactFieldConfig(slug, 'qualifikation')
  const [fieldDrawer, setFieldDrawer] = useState<
    null | 'erstgespraech' | 'qualifikation'
  >(null)
  const [editFields, setEditFields] = useState<SalesFieldItem[]>([])

  useEffect(() => {
    if (fieldDrawer === 'erstgespraech') setEditFields([...fieldCfgErst.fields])
    if (fieldDrawer === 'qualifikation') setEditFields([...fieldCfgQual.fields])
  }, [fieldDrawer, fieldCfgErst.fields, fieldCfgQual.fields])

  const activeFieldCfg =
    fieldDrawer === 'erstgespraech'
      ? fieldCfgErst
      : fieldDrawer === 'qualifikation'
        ? fieldCfgQual
        : null

  const contact = useMemo(() => {
    const fromList = contacts.items.find((c) => c.id === contactId) ?? null
    if (fromList) return fromList
    if (!slug || !contactId) return null
    return readContactsLocal(slug).find((c) => c.id === contactId) ?? null
  }, [contacts.items, contactId, slug])

  const [draft, setDraft] = useState<Contact | null>(null)
  const [allowMissing, setAllowMissing] = useState(false)

  // Draft nur bei Wechsel der contactId (oder beim initialen Load) syncen.
  // Würden wir bei jeder `contact`-Änderung syncen, überschreibt ein abgeschlossener
  // Save (der nur ein einzelnes Feld aktualisiert) die noch im Debounce schwebenden
  // Änderungen an anderen Feldern → Status/Tasks/Termin wirken "nicht gespeichert".
  useEffect(() => {
    if (contact) setDraft(contact)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId])

  // Beim allerersten Laden (falls contact erst verspätet aus dem Hook kommt)
  // einmalig den Draft initialisieren.
  useEffect(() => {
    if (!contact) return
    setDraft((prev) => (prev ? prev : contact))
  }, [contact])

  useEffect(() => {
    if (contact) {
      setAllowMissing(false)
      return
    }
    const t = window.setTimeout(() => setAllowMissing(true), 1200)
    return () => window.clearTimeout(t)
  }, [contact, contactId])

  const pushPatch = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!contactId || !slug) return
      contacts.update(contactId, patch)
    },
    [contactId, contacts, slug],
  )

  const { state: saveState, onField: saveField } = useContactFieldSave(pushPatch)

  const onField = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>, fieldKey?: string) => {
      setDraft((prev) => {
        const base = prev ?? contact
        if (!base) return null
        return { ...base, ...patch }
      })
      const key = fieldKey ?? (Object.keys(patch)[0] as string) ?? 'field'
      saveField(patch, key)
    },
    [saveField, contact],
  )

  const d = draft ?? contact
  const scrollRef = useRef<HTMLDivElement>(null)
  useContactScrollLock(scrollRef as RefObject<HTMLElement | null>)
  const { isMobile } = useViewport()
  const wideLayout = variant === 'page' && !isMobile
  const [activityModal, setActivityModal] = useState<ActivityModalType | null>(null)
  const [editingActivity, setEditingActivity] = useState<ActivityEntry | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [callOutcomeOpen, setCallOutcomeOpen] = useState(false)
  const [timelineRefresh, setTimelineRefresh] = useState(0)
  const calls = useCallLogs(slug, { contactId: contactId ?? '' })

  const duplicateProject = useMemo(() => {
    if (!d) return null
    return findDeliverProjectForContact(deliver.items, d)
  }, [deliver.items, d])
  const handleLogCall = useCallback(() => {
    setCallOutcomeOpen(true)
  }, [])

  const openActivityModal = useCallback((type: ActivityModalType) => {
    setEditingActivity(null)
    setActivityModal(type)
  }, [])

  const editActivity = useCallback((entry: ActivityEntry) => {
    setActivityModal(null)
    setEditingActivity(entry)
  }, [])

  const closeActivityModal = useCallback(() => {
    setActivityModal(null)
    setEditingActivity(null)
  }, [])

  const activeActivityModal: ActivityModalType | null = editingActivity
    ? (editingActivity.activity_type as ActivityModalType)
    : activityModal

  if (!slug || !contactId) {
    return <Navigate to="/" replace />
  }

  if (!contacts.loading && !contacts.error && !contact && allowMissing) {
    return <Navigate to={`/brand/${slug}/sales`} replace />
  }

  if (contacts.loading && !d && !contact) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 400,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (!d) {
    return null
  }

  return (
    <div
      ref={scrollRef}
      style={{
        pointerEvents: 'auto',
        background: 'transparent',
        maxHeight: variant === 'page' ? 'calc(100vh - 120px)' : undefined,
        overflowY: variant === 'page' ? 'auto' : undefined,
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="mb-4"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {variant === 'page' ? (
            <Link
              to={`/brand/${slug}/sales`}
              className="font-mono"
              style={{
                fontSize: 12,
                color: 'var(--mode-sales)',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
              }}
            >
              ← Zurück zur Pipeline
            </Link>
          ) : null}
          {duplicateProject ? (
            <button
              type="button"
              className="font-mono"
              onClick={() => navigate(`/brand/${slug}/deliver/${duplicateProject.id}`)}
              style={{
                fontSize: 12,
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent-teal)',
                color: '#0a0a12',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              → Zum Projekt
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="mb-3"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--mode-sales)',
          }}
        >
          Sales · Kontakt
        </div>
        <ContactSaveStatusIndicator state={saveState} />
      </div>

      {slug ? <ContactBccHint brandSlug={slug} /> : null}

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: wideLayout ? 'minmax(300px, 380px) minmax(0, 1fr)' : '1fr',
          alignItems: 'start',
        }}
      >
        {slug ? (
          <ContactOverviewPanel
            brandSlug={slug}
            contact={d}
            onField={onField}
            layout={variant === 'page' ? 'page' : 'narrow'}
            column="left"
            callOutcomeOpen={callOutcomeOpen}
            onCallOutcomeOpenChange={setCallOutcomeOpen}
            onTimelineRefresh={() => setTimelineRefresh((n) => n + 1)}
          />
        ) : null}

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ContactPhaseHeader contact={d} onField={onField} />

          {slug ? (
            <ContactActivityActionBar
              variant="header"
              brandSlug={slug}
              contact={d}
              onOpenModal={openActivityModal}
              onOpenEmail={() => setComposeOpen(true)}
              onCall={handleLogCall}
            />
          ) : null}

          {contacts.error ? (
            <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
              {contacts.error}
            </p>
          ) : null}

          {slug ? (
            <ContactOverviewPanel
              brandSlug={slug}
              contact={d}
              onField={onField}
              layout={variant === 'page' ? 'page' : 'narrow'}
              column="right"
              timelineRefresh={timelineRefresh}
              onTimelineRefresh={() => setTimelineRefresh((n) => n + 1)}
              onEditActivity={editActivity}
            />
          ) : null}
        </div>
      </div>

      {slug ? (
        <>
          <ActivityModalHost
            brandSlug={slug}
            contact={d}
            modal={activeActivityModal}
            editingEntry={editingActivity}
            onClose={closeActivityModal}
            onDone={() => {
              setTimelineRefresh((n) => n + 1)
              void calls.reload()
            }}
            onField={onField}
            onOpenCompose={() => setComposeOpen(true)}
          />
          <EmailComposeDialog
            open={composeOpen}
            onClose={() => setComposeOpen(false)}
            brandSlug={slug}
            contact={d}
            onLogged={() => {
              onField({ last_contact_at: new Date().toISOString() })
            }}
          />
        </>
      ) : null}

      <Drawer
        open={fieldDrawer !== null}
        onClose={() => setFieldDrawer(null)}
        title="Felder anpassen"
        width={420}
      >
        {activeFieldCfg ? (
          <div className="flex flex-col gap-3" style={{ pointerEvents: 'auto' }}>
            {editFields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-xl p-3"
                style={{
                  border: '1px solid var(--glass-border-1)',
                  background: 'var(--glass-1)',
                }}
              >
                <div className="mb-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="font-mono"
                    disabled={i === 0}
                    onClick={() => {
                      setEditFields((prev) => {
                        if (i <= 0) return prev
                        const next = [...prev]
                        const a = next[i - 1]!
                        const b = next[i]!
                        next[i - 1] = b
                        next[i] = a
                        return next.map((x, ord) => ({ ...x, order: ord }))
                      })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      opacity: i === 0 ? 0.4 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="font-mono"
                    disabled={i >= editFields.length - 1}
                    onClick={() => {
                      setEditFields((prev) => {
                        if (i >= prev.length - 1) return prev
                        const next = [...prev]
                        const a = next[i]!
                        const b = next[i + 1]!
                        next[i] = b
                        next[i + 1] = a
                        return next.map((x, ord) => ({ ...x, order: ord }))
                      })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      opacity: i >= editFields.length - 1 ? 0.4 : 1,
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => setEditFields((prev) => prev.filter((x) => x.id !== f.id))}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      color: 'var(--accent-coral)',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <input
                  value={f.label}
                  onChange={(e) =>
                    setEditFields((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  style={FIELD}
                />
              </div>
            ))}
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

