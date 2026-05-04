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
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useContacts } from '../../hooks/useContacts'
import type { Contact, PipelineStage } from '../../types/db'

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

/** Vergleicht Kalendertag (YYYY-MM-DD) mit heute — Follow-up heute oder früher = überfällig. */
function isFollowUpOverdue(nextFollowUpAt: string | null): boolean {
  if (!nextFollowUpAt) return false
  const ymd = nextFollowUpAt.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return ymd <= today
}

function DroppableStageColumn({
  stage,
  children,
}: {
  stage: PipelineStage
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <div
      ref={setNodeRef}
      className="glass-2 shrink-0"
      style={{
        width: 200,
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
}: {
  contact: Contact
  slug: string
  onSelect: () => void
  onCreateDeliverProject: () => void
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    padding: 10,
    borderRadius: 10,
    background: 'var(--glass-1)',
    border: overdue
      ? '2px solid var(--accent-coral)'
      : '1px solid var(--glass-border-2)',
    position: 'relative' as const,
    width: '100%',
    textAlign: 'left' as const,
    cursor: 'grab',
    touchAction: 'none' as const,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onClick={onSelect}
    >
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
      <Link
        to={`/brand/${slug}/sales/${contact.id}`}
        className="font-mono"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 6,
          left: 6,
          fontSize: 9,
          color: 'var(--accent-blue)',
          textDecoration: 'none',
          zIndex: 2,
        }}
      >
        Vollmaske ↗
      </Link>
      <div
        className="font-display"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          paddingRight: overdue ? 56 : 0,
          paddingLeft: 76,
          paddingTop: 2,
        }}
      >
        {contact.name}
      </div>
      <div
        className="font-mono mt-1"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', wordBreak: 'break-all' }}
      >
        {contact.email || '—'}
      </div>
      {contact.next_follow_up_at ? (
        <div
          className="font-mono mt-1"
          style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
        >
          Next: {contact.next_follow_up_at.slice(0, 10)}
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
}: {
  contacts: Contact[]
  slug: string
  onMoveToStage: (contactId: string, stage: PipelineStage) => void
  onSelectContact: (id: string) => void
  onCreateDeliverProject: (contact: Contact) => void
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
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const list = contacts.filter((c) => c.pipeline_stage === stage)
          return (
            <DroppableStageColumn key={stage} stage={stage}>
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
  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)

  const handleCreateDeliverFromContact = useCallback(
    (contact: Contact) => {
      if (!slug) return
      deliver.create({
        name: `Projekt · ${contact.name}`,
        client_name: contact.name,
        client_contact_id: contact.id,
        status: 'active',
      })
      navigate(`/brand/${slug}/deliver`)
    },
    [deliver, navigate, slug],
  )

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
      <div className="mb-6 flex items-center justify-between">
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
            Pipeline &amp; Kontakte
          </h2>
        </div>
        {!contacts.loading && !contacts.error ? (
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
              const c = contacts.create()
              navigate(`/brand/${slug}/sales/${c.id}`)
            }}
          >
            + Kontakt
          </button>
        ) : null}
      </div>

      <SectionLabel accent="var(--mode-sales)" tight>
        Pipeline
      </SectionLabel>

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
        <PipelineBoard
          contacts={contacts.items}
          slug={slug}
          onMoveToStage={(id, stage) =>
            contacts.update(id, { pipeline_stage: stage })
          }
          onSelectContact={(id) => navigate(`/brand/${slug}/sales/${id}`)}
          onCreateDeliverProject={handleCreateDeliverFromContact}
        />
      ) : null}
    </motion.div>
  )
}
