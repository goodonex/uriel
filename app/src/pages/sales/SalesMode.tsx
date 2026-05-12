import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { useSalesPipelines } from '../../hooks/useSalesPro'
import { EmailTemplatesDrawer } from '../../components/sales/EmailTemplatesDrawer'
import { PipelineSwitcher } from '../../components/sales/PipelineSwitcher'
import { SalesGoalsDrawer } from '../../components/sales/SalesGoalsDrawer'
import { SalesImportDrawer } from '../../components/sales/SalesImportDrawer'
import { SalesMeetingLinkDrawer } from '../../components/sales/SalesMeetingLinkDrawer'
import { SectionLabel } from '../../components/SectionLabel'
import { useToast } from '../../components/Toast'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useContacts } from '../../hooks/useContacts'
import type { Contact, PipelineStage } from '../../types/db'
import {
  filterPipelineContacts,
  formatEuroDe,
  pipelineValueEuro,
  potenzialKanbanLabel,
  type FollowFilter,
  type PotenzialFilter,
  type StageFilter,
} from '../../lib/salesPipelineFilters'
import { generateId } from '../../lib/storage'
import { ContactListsContent } from './ContactListsContent'

const STAGES: PipelineStage[] = [
  'first_contact',
  'conversation',
  'proposal',
  'deal',
  'paused',
]

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

/** Linker Rand der Pipeline-Card = Stage-Farbe */
const STAGE_ACCENT: Record<PipelineStage, string> = {
  first_contact: 'var(--mode-sales)',
  conversation: 'var(--accent-blue)',
  proposal: 'var(--accent-teal)',
  deal: '#4ade80',
  paused: 'var(--text-tertiary)',
}

function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function startOfWeekMondayMs(): number {
  const x = new Date()
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function isFollowUpDueTodayOrBefore(nextFollowUpAt: string | null): boolean {
  if (!nextFollowUpAt) return false
  return nextFollowUpAt.slice(0, 10) <= ymdToday()
}

function contactCardTitle(c: Contact): string {
  const n = c.name?.trim()
  if (n) return n
  const em = c.email?.trim()
  if (em) return em
  const ph = c.phone?.trim()
  if (ph) return ph
  return 'Unbenannt'
}

/** Vergleicht Kalendertag (YYYY-MM-DD) mit heute — Follow-up heute oder früher = überfällig. */
function isFollowUpOverdue(nextFollowUpAt: string | null): boolean {
  if (!nextFollowUpAt) return false
  const ymd = nextFollowUpAt.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return ymd <= today
}

function QuickNotePopover({
  onSave,
  onClose,
}: {
  onSave: (text: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      const el = ref.current?.closest('[data-quicknote-root]')
      if (el && !el.contains(t)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])

  return (
    <div
      data-quicknote-root
      className="glass-2"
      style={{
        position: 'absolute',
        top: 32,
        right: 4,
        zIndex: 40,
        width: 'calc(100% - 8px)',
        maxWidth: 220,
        padding: 10,
        borderRadius: 10,
        border: '1px solid var(--glass-border-2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            const t = text.trim()
            if (t) onSave(t)
            onClose()
          }
        }}
        rows={3}
        placeholder="Schnelle Notiz..."
        className="font-mono"
        style={{
          width: '100%',
          fontSize: 12,
          padding: 8,
          borderRadius: 8,
          border: '1px solid var(--glass-border-1)',
          background: 'var(--glass-1)',
          color: 'var(--text-primary)',
          resize: 'none' as const,
        }}
      />
    </div>
  )
}

function PipelineFilterBar({
  q,
  setQ,
  stage,
  setStage,
  follow,
  setFollow,
  potenzial,
  setPotenzial,
  onReset,
  filtersActive,
}: {
  q: string
  setQ: (s: string) => void
  stage: StageFilter
  setStage: (s: StageFilter) => void
  follow: FollowFilter
  setFollow: (f: FollowFilter) => void
  potenzial: PotenzialFilter
  setPotenzial: (p: PotenzialFilter) => void
  onReset: () => void
  filtersActive: boolean
}) {
  const pill = (on: boolean) => ({
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '6px 10px',
    borderRadius: 999,
    border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
    background: on
      ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
      : 'var(--glass-2)',
    color: on ? 'var(--mode-sales)' : 'var(--text-tertiary)',
    cursor: 'pointer' as const,
  })

  // Anzahl gesetzter Filter
  const activeCount =
    (stage !== 'all' ? 1 : 0) +
    (follow !== 'all' ? 1 : 0) +
    (potenzial !== 'all' ? 1 : 0)
  const [open, setOpen] = useState(activeCount > 0)

  return (
    <div
      className="glass-2 mb-3 flex flex-col gap-2 rounded-2xl p-3"
      style={{ border: '1px solid var(--glass-border-1)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Suche: Name, Firma, E-Mail …"
          className="font-mono min-w-[200px] flex-1 rounded-lg px-3 py-2"
          style={{
            fontSize: 12,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-1)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="font-mono inline-flex items-center gap-1.5"
          style={{
            fontSize: 11,
            padding: '8px 12px',
            borderRadius: 10,
            border: activeCount > 0
              ? '1px solid var(--mode-sales)'
              : '1px solid var(--glass-border-2)',
            background: activeCount > 0
              ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
              : 'var(--glass-3)',
            color: activeCount > 0 ? 'var(--mode-sales)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <svg width={11} height={11} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M2 4 L14 4 L10 9 L10 14 L6 12 L6 9 Z" />
          </svg>
          Filter
          {activeCount > 0 ? (
            <span
              style={{
                marginLeft: 2,
                padding: '0 6px',
                borderRadius: 999,
                background: 'var(--mode-sales)',
                color: '#000',
                fontSize: 9,
                fontWeight: 700,
                lineHeight: 1.6,
              }}
            >
              {activeCount}
            </span>
          ) : null}
          <span style={{ fontSize: 8, marginLeft: 2, opacity: 0.65 }}>
            {open ? '▲' : '▼'}
          </span>
        </button>
        {filtersActive ? (
          <button
            type="button"
            className="font-mono"
            onClick={onReset}
            style={{
              fontSize: 10,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--text-secondary)',
            }}
          >
            Zurücksetzen
          </button>
        ) : null}
      </div>
      {open ? (
      <>
      <div>
        <div className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          STAGE
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['first_contact', 'Erstkontakt'],
              ['conversation', 'Gespräch'],
              ['proposal', 'Angebot'],
              ['deal', 'Deal'],
              ['paused', 'Pause'],
            ] as const
          ).map(([key, label]) => {
            const on = stage === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono"
                style={pill(on)}
                onClick={() => setStage(key as StageFilter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          FOLLOW-UP
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['today', 'Heute fällig'],
              ['week', 'Diese Woche'],
              ['none', 'Ohne Datum'],
            ] as const
          ).map(([key, label]) => {
            const on = follow === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono"
                style={pill(on)}
                onClick={() => setFollow(key as FollowFilter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="font-mono mb-1.5" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          POTENZIAL
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Alle'],
              ['lt1k', '< 1k'],
              ['1k5k', '1k–5k'],
              ['5k10k', '5k–10k'],
              ['gt10k', '> 10k'],
            ] as const
          ).map(([key, label]) => {
            const on = potenzial === key
            return (
              <button
                key={key}
                type="button"
                className="font-mono"
                style={pill(on)}
                onClick={() => setPotenzial(key as PotenzialFilter)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      </>
      ) : null}
    </div>
  )
}

function DroppableStageColumn({
  stage,
  children,
  onStageHover,
}: {
  stage: PipelineStage
  children: ReactNode
  onStageHover?: (stage: PipelineStage | null) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <div
      ref={setNodeRef}
      className="glass-2 shrink-0"
      onPointerEnter={() => onStageHover?.(stage)}
      style={{
        width: 'min(200px, calc(100vw - 48px))',
        minWidth: 'min(200px, calc(100vw - 48px))',
        borderRadius: 14,
        padding: 10,
        border: isOver
          ? '2px solid var(--mode-sales)'
          : '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
        minHeight: 120,
      }}
    >
      <div
        className="font-mono mb-2"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}
      >
        {STAGE_LABEL[stage]}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function SortableContactCard({
  contact,
  slug,
  onSelect,
  onCreateDeliverProject,
  onAppendActivity,
  quickNoteOpen,
  setQuickNoteOpen,
  selected,
  onToggleSelected,
  bulkActive,
}: {
  contact: Contact
  slug: string
  onSelect: () => void
  onCreateDeliverProject: () => void
  onAppendActivity: (contactId: string, text: string) => void
  quickNoteOpen: boolean
  setQuickNoteOpen: (open: boolean) => void
  selected: boolean
  onToggleSelected: () => void
  bulkActive: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact.id })

  const overdue = isFollowUpOverdue(contact.next_follow_up_at)
  const stageColor = STAGE_ACCENT[contact.pipeline_stage]
  const title = contactCardTitle(contact)
  const subtitle =
    contact.email?.trim() ||
    contact.phone?.trim() ||
    '—'

  const [hover, setHover] = useState(false)
  const showChk = bulkActive || hover
  const potLabel = potenzialKanbanLabel(contact)
  const linkRight = overdue ? 64 : 6
  const noteRight = overdue ? 110 : 52

  const style = {
    transform: isDragging
      ? `${CSS.Transform.toString(transform) ?? ''} scale(1.02)`
      : CSS.Transform.toString(transform),
    transition: isDragging ? 'box-shadow 160ms ease' : transition,
    opacity: isDragging ? 0.95 : 1,
    padding: 10,
    paddingLeft: 12,
    borderRadius: 10,
    background: isDragging ? 'var(--glass-3)' : 'var(--glass-1)',
    border: overdue
      ? '1px solid var(--accent-coral)'
      : selected
        ? '1px solid var(--accent-teal)'
        : isDragging
          ? '1px solid var(--glass-border-3)'
          : '1px solid var(--glass-border-2)',
    borderLeft: `4px solid ${stageColor}`,
    position: 'relative' as const,
    width: '100%',
    textAlign: 'left' as const,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none' as const,
    boxShadow: isDragging
      ? '0 18px 40px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.25)'
      : undefined,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onClick={onSelect}
    >
      {showChk ? (
        <label
          className="absolute left-1 top-2 flex cursor-pointer items-center"
          style={{ zIndex: 4 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            style={{ width: 14, height: 14, accentColor: 'var(--mode-sales)' }}
          />
        </label>
      ) : null}
      {overdue ? (
        <span
          className="font-mono"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            fontSize: 8,
            letterSpacing: '0.04em',
            padding: '3px 7px',
            borderRadius: 6,
            background: 'var(--accent-coral)',
            color: '#fff',
          }}
        >
          Überfällig
        </span>
      ) : null}
      <button
        type="button"
        title="Schnelle Notiz"
        className="font-mono"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseEnter={() => setHover(true)}
        onClick={(e) => {
          e.stopPropagation()
          setQuickNoteOpen(true)
        }}
        style={{
          position: 'absolute',
          top: 6,
          right: noteRight,
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          zIndex: 3,
          opacity: hover || quickNoteOpen ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        ✎
      </button>
      <Link
        to={`/brand/${slug}/sales/${contact.id}`}
        className="font-mono"
        title="Vollmaske"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 6,
          right: linkRight,
          fontSize: 11,
          lineHeight: 1,
          color: 'var(--accent-blue)',
          textDecoration: 'none',
          zIndex: 2,
          opacity: 0.85,
        }}
      >
        ↗
      </Link>
      {quickNoteOpen ? (
        <QuickNotePopover
          onClose={() => setQuickNoteOpen(false)}
          onSave={(txt) => onAppendActivity(contact.id, `📝 ${txt}`)}
        />
      ) : null}
      <div
        className="font-display"
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--text-primary)',
          paddingRight: 28,
          paddingTop: 2,
          marginLeft: showChk ? 18 : 0,
        }}
      >
        {title}
      </div>
      <div
        className="font-mono mt-1"
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          wordBreak: 'break-all',
        }}
      >
        {subtitle}
      </div>
      {contact.next_follow_up_at ? (
        <div
          className="font-mono mt-1"
          style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
        >
          Next: {contact.next_follow_up_at.slice(0, 10)}
        </div>
      ) : null}
      {potLabel ? (
        <div
          className="font-mono mt-2 inline-block rounded-md px-2 py-0.5"
          style={{
            fontSize: 9,
            color: 'var(--accent-teal)',
            background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-teal) 40%, transparent)',
          }}
        >
          {potLabel}
        </div>
      ) : null}
      {contact.pipeline_stage === 'deal' ? (
        <button
          type="button"
          className="font-mono mt-2"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--accent-teal)',
            color: 'var(--accent-teal)',
            background: 'var(--glass-2)',
            width: '100%',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onCreateDeliverProject()
          }}
        >
          Projekt anlegen
        </button>
      ) : null}
    </div>
  )
}

function PipelineBoard({
  contacts,
  slug,
  onMoveToStage,
  onSelectContact,
  onCreateDeliverProject,
  onAppendActivity,
  quickNoteId,
  setQuickNoteId,
  selectedIds,
  onToggleSelected,
  bulkActive,
  onColumnHover,
}: {
  contacts: Contact[]
  slug: string
  onMoveToStage: (contactId: string, stage: PipelineStage) => void
  onSelectContact: (id: string) => void
  onCreateDeliverProject: (contact: Contact) => void
  onAppendActivity: (contactId: string, text: string) => void
  quickNoteId: string | null
  setQuickNoteId: (id: string | null) => void
  selectedIds: Set<string>
  onToggleSelected: (id: string) => void
  bulkActive: boolean
  onColumnHover?: (stage: PipelineStage | null) => void
}) {
  const skipClickRef = useRef(false)
  const markSkipClick = useCallback(() => {
    skipClickRef.current = true
    window.setTimeout(() => {
      skipClickRef.current = false
    }, 220)
  }, [])

  const [activeDrag, setActiveDrag] = useState<Contact | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
  )

  const resolveTargetStage = useCallback(
    (overId: string | number | null | undefined): PipelineStage | null => {
      if (overId == null) return null
      const oid = String(overId)
      if ((STAGES as readonly string[]).includes(oid))
        return oid as PipelineStage
      const overContact = contacts.find((c) => c.id === oid)
      return overContact ? overContact.pipeline_stage : null
    },
    [contacts],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    markSkipClick()
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return
    const target = resolveTargetStage(over.id)
    const activeId = String(active.id)
    const contact = contacts.find((c) => c.id === activeId)
    if (!contact || !target || contact.pipeline_stage === target) return
    onMoveToStage(activeId, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }: DragStartEvent) => {
        setActiveDrag(
          contacts.find((c) => c.id === String(active.id)) ?? null,
        )
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        markSkipClick()
        setActiveDrag(null)
      }}
    >
      <div
        className="flex gap-2 overflow-x-auto pb-2 overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onPointerLeave={() => onColumnHover?.(null)}
      >
        {STAGES.map((stage) => {
          const list = contacts.filter((c) => c.pipeline_stage === stage)
          return (
            <DroppableStageColumn
              key={stage}
              stage={stage}
              onStageHover={onColumnHover}
            >
              <SortableContext
                items={list.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {list.map((c) => (
                  <SortableContactCard
                    key={c.id}
                    contact={c}
                    slug={slug}
                    onSelect={() => {
                      if (skipClickRef.current) return
                      onSelectContact(c.id)
                    }}
                    onCreateDeliverProject={() => onCreateDeliverProject(c)}
                    onAppendActivity={onAppendActivity}
                    quickNoteOpen={quickNoteId === c.id}
                    setQuickNoteOpen={(open) => setQuickNoteId(open ? c.id : null)}
                    selected={selectedIds.has(c.id)}
                    onToggleSelected={() => onToggleSelected(c.id)}
                    bulkActive={bulkActive}
                  />
                ))}
              </SortableContext>
            </DroppableStageColumn>
          )
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-border-2)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
              minWidth: 168,
            }}
          >
            <div
              className="font-display"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {activeDrag.name}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function SalesMode() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  // brandId wird in den Hooks (useBrandId) intern verwendet; hier nicht mehr direkt nötig.
  const { show: showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const salesTab: 'pipeline' | 'listen' =
    searchParams.get('tab') === 'listen' ? 'listen' : 'pipeline'

  const setSalesTab = useCallback(
    (t: 'pipeline' | 'listen') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (t === 'listen') next.set('tab', 'listen')
          else next.delete('tab')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)

  const [pipeQ, setPipeQ] = useState('')
  const [pipeStage, setPipeStage] = useState<StageFilter>('all')
  const [pipeFollow, setPipeFollow] = useState<FollowFilter>('all')
  const [pipePotenzial, setPipePotenzial] = useState<PotenzialFilter>('all')

  const filteredPipeline = useMemo(
    () =>
      filterPipelineContacts(contacts.items, {
        q: pipeQ,
        stage: pipeStage,
        follow: pipeFollow,
        potenzial: pipePotenzial,
      }),
    [contacts.items, pipeFollow, pipePotenzial, pipeQ, pipeStage],
  )

  const pipelineValue = useMemo(
    () => pipelineValueEuro(contacts.items),
    [contacts.items],
  )

  const filtersActive = useMemo(() => {
    return (
      pipeQ.trim().length > 0 ||
      pipeStage !== 'all' ||
      pipeFollow !== 'all' ||
      pipePotenzial !== 'all'
    )
  }, [pipeFollow, pipePotenzial, pipeQ, pipeStage])

  const resetFilters = useCallback(() => {
    setPipeQ('')
    setPipeStage('all')
    setPipeFollow('all')
    setPipePotenzial('all')
  }, [])

  const [quickNoteId, setQuickNoteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const bulkActive = selectedIds.size > 0

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const [bulkStagePick, setBulkStagePick] = useState<PipelineStage>('first_contact')
  const [bulkFollowYmd, setBulkFollowYmd] = useState('')
  const [columnHover, setColumnHover] = useState<PipelineStage | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (salesTab !== 'pipeline' || contacts.loading) return
      const t = e.target as HTMLElement
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT')
        return
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        const pick = filteredPipeline.filter((c) =>
          columnHover ? c.pipeline_stage === columnHover : true,
        )
        setSelectedIds(new Set(pick.map((c) => c.id)))
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [columnHover, contacts.loading, filteredPipeline, salesTab])

  const appendActivity = useCallback(
    (contactId: string, text: string) => {
      const c = contacts.items.find((x) => x.id === contactId)
      if (!c) return
      const entry = { id: generateId(), text, at: new Date().toISOString() }
      contacts.update(contactId, { activity_log: [...c.activity_log, entry] })
      setQuickNoteId(null)
    },
    [contacts],
  )

  const [dupModal, setDupModal] = useState<{
    partial: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>
    existing: Contact
    mode: 'empty' | 'quick'
  } | null>(null)

  const finishCreate = useCallback(
    (partial: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>) => {
      const r = contacts.create(partial, { skipDuplicateCheck: true })
      if (r.ok) {
        setDupModal(null)
        navigate(`/brand/${slug}/sales/${r.contact.id}`)
      }
    },
    [contacts, navigate, slug],
  )

  const tryCreate = useCallback(
    (
      partial: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
      mode: 'empty' | 'quick',
    ) => {
      const r = contacts.create(partial)
      if (r.ok) {
        setDupModal(null)
        if (mode === 'quick') {
          setQuickOpen(false)
        }
        navigate(`/brand/${slug}/sales/${r.contact.id}`)
      } else {
        setDupModal({ partial, existing: r.duplicate, mode })
      }
    },
    [contacts, navigate, slug],
  )

  const callModeSearch = useMemo(() => {
    const p = new URLSearchParams()
    p.set('source', 'pipeline')
    if (pipeQ.trim()) p.set('pipeQ', pipeQ.trim())
    if (pipeStage !== 'all') p.set('pipeStage', pipeStage)
    if (pipeFollow !== 'all') p.set('pipeFollow', pipeFollow)
    if (pipePotenzial !== 'all') p.set('pipePotenzial', pipePotenzial)
    return p.toString()
  }, [pipeFollow, pipePotenzial, pipeQ, pipeStage])

  const pipelineStats = useMemo(() => {
    const items = contacts.items
    const active = items.filter((c) => c.pipeline_stage !== 'paused')
    const dueToday = active.filter((c) => isFollowUpDueTodayOrBefore(c.next_follow_up_at))
    const wk0 = startOfWeekMondayMs()
    const weekDeals = items.filter(
      (c) => c.pipeline_stage === 'deal' && new Date(c.updated_at).getTime() >= wk0,
    )
    return {
      totalInPipeline: active.length,
      dueTodayCount: dueToday.length,
      weekClosedCount: weekDeals.length,
      dueTodayList: dueToday,
    }
  }, [contacts.items])

  const [quickOpen, setQuickOpen] = useState(false)
  const [qdName, setQdName] = useState('')
  const [qdPhone, setQdPhone] = useState('')
  const [qdEmail, setQdEmail] = useState('')
  const [qdNote, setQdNote] = useState('')

  // Sales-Pro Drawer
  // Auto-seed default pipeline (Hook initialisiert sie selbst, wenn keine existiert)
  useSalesPipelines(slug)
  const [activePipelineSlug, setActivePipelineSlug] = useState<string | null>(null)
  const [tplDrawerOpen, setTplDrawerOpen] = useState(false)
  const [goalsDrawerOpen, setGoalsDrawerOpen] = useState(false)
  const [importDrawerOpen, setImportDrawerOpen] = useState(false)
  const [meetingDrawerOpen, setMeetingDrawerOpen] = useState(false)
  const [bulkTagInput, setBulkTagInput] = useState('')

  const openQuickDeal = useCallback(() => {
    setQdName('')
    setQdPhone('')
    setQdEmail('')
    setQdNote('')
    setQuickOpen(true)
  }, [])

  const handleCreateDeliverFromContact = useCallback(
    (contact: Contact) => {
      if (!slug) return
      const proj = deliver.create({
        name: `${contact.name || 'Kontakt'} — Projekt`,
        client_name: contact.name ?? '',
        client_email: contact.email?.trim() ?? '',
        client_contact_id: contact.id,
        internal_stage: 'onboarding',
        client_stage: 'onboarding',
        status: 'active',
      })
      navigate(`/brand/${slug}/deliver/${proj.id}`)
    },
    [deliver, navigate, slug],
  )

  const selectedContactList = useMemo(
    () => contacts.items.filter((c) => selectedIds.has(c.id)),
    [contacts.items, selectedIds],
  )

  const applyBulkStage = useCallback(() => {
    for (const c of selectedContactList) {
      contacts.update(c.id, { pipeline_stage: bulkStagePick })
    }
    setSelectedIds(new Set())
  }, [bulkStagePick, contacts, selectedContactList])

  const applyBulkFollow = useCallback(() => {
    const iso =
      bulkFollowYmd.trim() === ''
        ? null
        : new Date(bulkFollowYmd + 'T12:00:00').toISOString()
    for (const c of selectedContactList) {
      contacts.update(c.id, { next_follow_up_at: iso })
    }
    setSelectedIds(new Set())
    setBulkFollowYmd('')
  }, [bulkFollowYmd, contacts, selectedContactList])

  const applyBulkDelete = useCallback(() => {
    const n = selectedContactList.length
    if (
      n === 0 ||
      !window.confirm(`${n} Kontakt${n === 1 ? '' : 'e'} wirklich löschen?`)
    )
      return
    for (const c of selectedContactList) {
      contacts.remove(c.id)
    }
    setSelectedIds(new Set())
  }, [contacts, selectedContactList])

  const applyBulkTag = useCallback(() => {
    const tag = bulkTagInput.trim()
    if (!tag) return
    for (const c of selectedContactList) {
      const existing = Array.isArray(c.tags) ? c.tags : []
      if (existing.includes(tag)) continue
      contacts.update(c.id, { tags: [...existing, tag] })
    }
    setBulkTagInput('')
    showToast(`Tag "${tag}" gesetzt`, 'success')
  }, [bulkTagInput, contacts, selectedContactList, showToast])

  const pipelineTotal = contacts.items.length
  const pipelineFilteredCount = filteredPipeline.length

  if (!slug) {
    return null
  }

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent', pointerEvents: 'auto' }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mode-sales)',
              marginBottom: 6,
            }}
          >
            Sales Mode
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            Pipeline &amp; Kontakte ({pipelineFilteredCount} von {pipelineTotal})
          </h2>
          {slug ? (
            <div className="mt-3">
              <PipelineSwitcher
                brandSlug={slug}
                selectedSlug={activePipelineSlug}
                onChange={setActivePipelineSlug}
              />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {(['pipeline', 'listen'] as const).map((t) => {
              const on = salesTab === t
              return (
                <button
                  key={t}
                  type="button"
                  className="font-mono"
                  onClick={() => setSalesTab(t)}
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
                    background: on
                      ? 'color-mix(in srgb, var(--mode-sales) 16%, transparent)'
                      : 'var(--glass-2)',
                    color: on ? 'var(--mode-sales)' : 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  {t === 'pipeline' ? 'Pipeline' : 'Listen'}
                </button>
              )
            })}
          </div>
        </div>
        {!contacts.loading && !contacts.error ? (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/brand/${slug}/sales/call-mode?${callModeSearch}`}
              className="font-mono"
              style={{
                fontSize: 12,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-3)',
                color: 'var(--mode-sales)',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              📞 Call Mode
            </Link>
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 12,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid var(--mode-sales)',
                background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
                color: 'var(--mode-sales)',
              }}
              onClick={openQuickDeal}
            >
              Schnell-Deal
            </button>
            <button
              type="button"
              onClick={() => setTplDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="E-Mail-Templates verwalten"
            >
              ✉ Templates
            </button>
            <button
              type="button"
              onClick={() => setGoalsDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="Wochenziele setzen"
            >
              ◎ Ziele
            </button>
            <button
              type="button"
              onClick={() => setImportDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="CSV-Import"
            >
              ⇪ Import
            </button>
            <button
              type="button"
              onClick={() => setMeetingDrawerOpen(true)}
              className="font-mono"
              style={proSettingsBtn}
              title="Buchungslink konfigurieren"
            >
              📅 Buchungslink
            </button>
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 12,
                padding: '10px 16px',
                borderRadius: 12,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-3)',
                color: 'var(--mode-sales)',
              }}
              onClick={() => {
                tryCreate({}, 'empty')
              }}
            >
              + Kontakt
            </button>
          </div>
        ) : null}
      </div>

      {salesTab === 'listen' ? (
        <ContactListsContent slug={slug} embedded />
      ) : (
        <>
          {contacts.loading ? (
            <div
              className="animate-pulse"
              style={{
                minHeight: 220,
                borderRadius: 16,
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
              }}
            />
          ) : null}

          {contacts.error ? (
            <div
              className="font-mono"
              style={{ fontSize: 12, color: 'var(--accent-coral)' }}
            >
              Kontakte konnten nicht geladen werden: {contacts.error}
            </div>
          ) : null}

          {!contacts.loading && !contacts.error ? (
            <div
              className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              {(
                [
                  {
                    k: 'Gesamt in Pipeline',
                    v: String(pipelineStats.totalInPipeline),
                  },
                  { k: 'Heute fällig', v: String(pipelineStats.dueTodayCount) },
                  {
                    k: 'Diese Woche abgeschlossen',
                    v: String(pipelineStats.weekClosedCount),
                  },
                  { k: 'Pipeline-Wert', v: formatEuroDe(pipelineValue) },
                ] as const
              ).map((s) => (
                <div
                  key={s.k}
                  className="glass-2 rounded-xl px-4 py-3"
                  style={{ border: '1px solid var(--glass-border-1)' }}
                >
                  <div
                    className="font-mono"
                    style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6 }}
                  >
                    {s.k}
                  </div>
                  <div
                    className="font-display"
                    style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {s.v}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!contacts.loading && !contacts.error ? (
            <div className="mb-5">
              <PipelineFilterBar
                q={pipeQ}
                setQ={setPipeQ}
                stage={pipeStage}
                setStage={setPipeStage}
                follow={pipeFollow}
                setFollow={setPipeFollow}
                potenzial={pipePotenzial}
                setPotenzial={setPipePotenzial}
                onReset={resetFilters}
                filtersActive={filtersActive}
              />
            </div>
          ) : null}

          <SectionLabel accent="var(--mode-sales)" tight>
            Pipeline
          </SectionLabel>

          {!contacts.loading && !contacts.error ? (
            <PipelineBoard
              contacts={filteredPipeline}
              slug={slug}
              onMoveToStage={(id, stage) =>
                contacts.update(id, { pipeline_stage: stage })
              }
              onSelectContact={(id) => navigate(`/brand/${slug}/sales/${id}`)}
              onCreateDeliverProject={handleCreateDeliverFromContact}
              onAppendActivity={appendActivity}
              quickNoteId={quickNoteId}
              setQuickNoteId={setQuickNoteId}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelect}
              bulkActive={bulkActive}
              onColumnHover={setColumnHover}
            />
          ) : null}

          {!contacts.loading && !contacts.error && bulkActive ? (
            <div
              className="glass-2 font-mono"
              style={{
                position: 'fixed',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                width: 'min(640px, calc(100vw - 32px))',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid var(--glass-border-1)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                pointerEvents: 'auto',
                fontSize: 11,
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {selectedIds.size} Kontakt{selectedIds.size === 1 ? '' : 'e'} ausgewählt
              </span>
              <select
                value={bulkStagePick}
                onChange={(e) => setBulkStagePick(e.target.value as PipelineStage)}
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-primary)',
                }}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyBulkStage}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 12%, transparent)',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                }}
              >
                Stage ändern
              </button>
              <input
                type="date"
                value={bulkFollowYmd}
                onChange={(e) => setBulkFollowYmd(e.target.value)}
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={applyBulkFollow}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--accent-teal)',
                  background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                  color: 'var(--accent-teal)',
                  cursor: 'pointer',
                }}
              >
                Follow-up setzen
              </button>
              <input
                type="text"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyBulkTag()
                  }
                }}
                placeholder="Tag …"
                style={{
                  fontSize: 11,
                  padding: '6px 8px',
                  width: 90,
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={applyBulkTag}
                disabled={!bulkTagInput.trim()}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-secondary)',
                  cursor: bulkTagInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: bulkTagInput.trim() ? 1 : 0.5,
                }}
              >
                + Tag
              </button>
              <button
                type="button"
                onClick={applyBulkDelete}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--accent-coral)',
                  color: 'var(--accent-coral)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Löschen
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-3)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Abwählen
              </button>
            </div>
          ) : null}

          {dupModal ? (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 70,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                padding: 16,
              }}
            >
              <div
                className="glass-2 font-mono"
                role="dialog"
                aria-modal="true"
                style={{
                  width: 'min(400px, 100%)',
                  padding: 20,
                  borderRadius: 16,
                  border: '1px solid var(--glass-border-1)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ marginBottom: 12, fontWeight: 600 }}>
                  Mögliches Duplikat gefunden
                </div>
                <div style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  {contactCardTitle(dupModal.existing)} — {(dupModal.existing.email || '—').trim() || '—'}{' '}
                  — {STAGE_LABEL[dupModal.existing.pipeline_stage]}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => finishCreate(dupModal.partial)}
                    style={{
                      flex: '1 1 140px',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--mode-sales)',
                      background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
                      color: 'var(--mode-sales)',
                      cursor: 'pointer',
                    }}
                  >
                    Trotzdem anlegen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ex = dupModal.existing
                      const wasQuick = dupModal.mode === 'quick'
                      setDupModal(null)
                      if (wasQuick) setQuickOpen(false)
                      navigate(`/brand/${slug}/sales/${ex.id}`)
                    }}
                    style={{
                      flex: '1 1 140px',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--accent-teal)',
                      background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                      color: 'var(--accent-teal)',
                      cursor: 'pointer',
                    }}
                  >
                    Zum bestehenden Kontakt
                  </button>
                  <button
                    type="button"
                    onClick={() => setDupModal(null)}
                    style={{
                      flex: '1 1 100%',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--glass-border-2)',
                      background: 'var(--glass-3)',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!contacts.loading && !contacts.error &&
          pipelineStats.dueTodayList.length > 0 ? (
            <div
              className="glass-2 mt-6 rounded-2xl p-4"
              style={{ border: '1px solid var(--glass-border-1)' }}
            >
              <div
                className="font-mono mb-3"
                style={{ fontSize: 10, color: 'var(--mode-sales)' }}
              >
                Heute fällig
              </div>
              <ul className="flex flex-col gap-2">
                {pipelineStats.dueTodayList.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/brand/${slug}/sales/${c.id}`}
                      className="font-mono block rounded-lg px-3 py-2 transition-colors hover:bg-[var(--glass-3)]"
                      style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        border: '1px solid var(--glass-border-2)',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{contactCardTitle(c)}</span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                        {STAGE_LABEL[c.pipeline_stage]}
                      </span>
                      {c.next_follow_up_at ? (
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                          {c.next_follow_up_at.slice(0, 10)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}

      <Drawer
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        title="Schnell-Deal"
        width={360}
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Name
            </span>
            <input
              value={qdName}
              onChange={(e) => setQdName(e.target.value)}
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
              placeholder="Firma oder Person"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Telefon
            </span>
            <input
              type="tel"
              autoComplete="tel"
              value={qdPhone}
              onChange={(e) => setQdPhone(e.target.value)}
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
              placeholder="+49 …"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              E-Mail
            </span>
            <input
              type="email"
              autoComplete="email"
              value={qdEmail}
              onChange={(e) => setQdEmail(e.target.value)}
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
              placeholder="name@…"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Erste Notiz
            </span>
            <textarea
              value={qdNote}
              onChange={(e) => setQdNote(e.target.value)}
              rows={3}
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
              placeholder="Kontext, Quelle, nächster Schritt…"
            />
          </label>
          <button
            type="button"
            className="font-mono mt-1"
            style={{
              fontSize: 13,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--mode-sales)',
              background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
              color: 'var(--mode-sales)',
            }}
            onClick={() => {
              tryCreate(
                {
                  name: qdName.trim() || 'Neuer Kontakt',
                  email: qdEmail.trim(),
                  phone: qdPhone.trim(),
                  pipeline_stage: 'first_contact',
                  notes: qdNote.trim(),
                },
                'quick',
              )
            }}
          >
            Speichern &amp; öffnen
          </button>
        </div>
      </Drawer>

      <EmailTemplatesDrawer
        open={tplDrawerOpen}
        onClose={() => setTplDrawerOpen(false)}
        brandSlug={slug}
      />
      <SalesGoalsDrawer
        open={goalsDrawerOpen}
        onClose={() => setGoalsDrawerOpen(false)}
        brandSlug={slug}
      />
      <SalesImportDrawer
        open={importDrawerOpen}
        onClose={() => setImportDrawerOpen(false)}
        brandSlug={slug}
      />
      <SalesMeetingLinkDrawer
        open={meetingDrawerOpen}
        onClose={() => setMeetingDrawerOpen(false)}
        brandSlug={slug}
      />
    </motion.div>
  )
}

const proSettingsBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}
