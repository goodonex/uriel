import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { findDeliverProjectForContact } from '../sales/ContactDeliverCard'
import { useContacts } from '../../hooks/useContacts'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useGlobalMessages } from '../../hooks/useGlobalMessages'
import { useProjectMessages } from '../../hooks/useProjectMessages'
import { generateId } from '../../lib/storage'
import type { Contact } from '../../types/db'

interface MessagesInboxProps {
  slug: string
  senderName: string
}

type ActiveThread =
  | { kind: 'project'; projectId: string; label?: string }
  | { kind: 'contact'; contactId: string; label: string }
  | null

export function MessagesInbox({ slug, senderName }: MessagesInboxProps) {
  const { messages, loading, markProjectRead } = useGlobalMessages(slug)
  const [activeThread, setActiveThread] = useState<ActiveThread>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const contacts = useContacts(slug)
  const projects = useDeliverProjects(slug)

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []

    const contactHits = contacts.items
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        label: c.name || c.email || 'Kontakt',
        sub: c.email || c.company || 'Lead',
        kind: 'contact' as const,
        contact: c,
      }))

    const projectHits = projects.items
      .filter((p) => p.name.toLowerCase().includes(q) || (p.client_name ?? '').toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        label: p.name,
        sub: p.client_name ? `Projekt · ${p.client_name}` : 'Projekt',
        kind: 'project' as const,
        projectId: p.id,
      }))

    return [...projectHits, ...contactHits]
  }, [contacts.items, projects.items, search])

  const openProjectThread = (projectId: string, label?: string) => {
    void markProjectRead(projectId)
    setActiveThread({ kind: 'project', projectId, label })
    setSearchOpen(false)
  }

  const openContactThread = (contact: Contact) => {
    const project = findDeliverProjectForContact(projects.items, contact)
    if (project) {
      openProjectThread(project.id, contact.name || project.name)
      return
    }
    setActiveThread({
      kind: 'contact',
      contactId: contact.id,
      label: contact.name || contact.email || 'Lead',
    })
    setSearchOpen(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--glass-border-2)] px-3 py-2">
        <button
          type="button"
          className="font-mono rounded-lg px-2 py-1"
          style={{ fontSize: 11, border: '1px solid var(--glass-border-2)', color: 'var(--accent-teal)' }}
          onClick={() => setSearchOpen((v) => !v)}
        >
          + Neue Nachricht
        </button>
      </div>

      {searchOpen ? (
        <div className="border-b border-[var(--glass-border-2)] px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, Lead oder Projekt…"
            className="w-full rounded-lg px-3 py-2"
            style={{
              fontSize: 13,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />
          <ul className="mt-2 max-h-40 overflow-y-auto">
            {searchResults.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--glass-2)]"
                  onClick={() => {
                    if (hit.kind === 'project') {
                      openProjectThread(hit.projectId, hit.label)
                    } else {
                      openContactThread(hit.contact)
                    }
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{hit.label}</span>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {hit.sub}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!activeThread ? (
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="font-mono px-2 py-4" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Laden…
            </p>
          ) : null}
          {!loading && messages.length === 0 ? (
            <p className="font-mono px-2 py-4" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Keine Nachrichten. Suche einen Lead oder ein Projekt.
            </p>
          ) : null}
          {messages.map((msg) => (
            <button
              key={msg.id}
              type="button"
              className="mb-1 flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-[var(--glass-2)]"
              onClick={() => openProjectThread(msg.project_id, msg.sender_name ?? undefined)}
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {msg.sender_name ?? 'Kunde'}
                </span>
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {new Date(msg.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--accent-teal)' }}>
                {msg.project_name ?? 'Projekt'}
              </span>
              <span className="line-clamp-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {msg.body}
              </span>
            </button>
          ))}
        </div>
      ) : activeThread.kind === 'project' ? (
        <HubProjectThread
          projectId={activeThread.projectId}
          threadLabel={activeThread.label}
          senderName={senderName}
          slug={slug}
          onBack={() => setActiveThread(null)}
        />
      ) : (
        <HubContactThread
          slug={slug}
          contactId={activeThread.contactId}
          threadLabel={activeThread.label}
          senderName={senderName}
          onBack={() => setActiveThread(null)}
        />
      )}
    </div>
  )
}

function HubProjectThread({
  projectId,
  threadLabel,
  senderName,
  slug,
  onBack,
}: {
  projectId: string
  threadLabel?: string
  senderName: string
  slug: string
  onBack: () => void
}) {
  const navigate = useNavigate()
  const { messages, loading, sending, send } = useProjectMessages(projectId, 'owner', senderName)
  const [draft, setDraft] = useState('')

  const handleSend = async () => {
    if (!draft.trim()) return
    const result = await send(draft)
    if (result.ok) setDraft('')
  }

  return (
    <ThreadShell
      title={threadLabel ?? 'Projekt-Chat'}
      subtitle="Portal-Nachrichten"
      onBack={onBack}
      onOpenDetail={() => navigate(`/brand/${slug}/deliver/${projectId}`)}
      detailLabel="Projekt öffnen"
      draft={draft}
      onDraftChange={setDraft}
      onSend={() => void handleSend()}
      sending={sending}
      placeholder="Nachricht an Kundenportal…"
    >
      {loading ? <p style={{ fontSize: 12 }}>Laden…</p> : null}
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          mine={msg.sender_role === 'owner'}
          author={msg.sender_role === 'client' ? msg.sender_name ?? 'Kunde' : 'Du'}
          body={msg.body}
        />
      ))}
    </ThreadShell>
  )
}

function HubContactThread({
  slug,
  contactId,
  threadLabel,
  senderName,
  onBack,
}: {
  slug: string
  contactId: string
  threadLabel: string
  senderName: string
  onBack: () => void
}) {
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const contact = contacts.items.find((c) => c.id === contactId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!contact || !draft.trim()) return
    setSending(true)
    const entry = {
      id: generateId(),
      text: `${senderName}: ${draft.trim()}`,
      at: new Date().toISOString(),
    }
    await contacts.update(contact.id, {
      activity_log: [entry, ...(contact.activity_log ?? [])],
      last_contact_at: new Date().toISOString(),
    })
    setDraft('')
    setSending(false)
  }

  const log = contact?.activity_log ?? []

  return (
    <ThreadShell
      title={threadLabel}
      subtitle="Lead · interner Thread"
      onBack={onBack}
      onOpenDetail={() => navigate(`/brand/${slug}/sales/${contactId}`)}
      detailLabel="Kontakt öffnen"
      draft={draft}
      onDraftChange={setDraft}
      onSend={() => void handleSend()}
      sending={sending}
      placeholder="Nachricht an Lead (wird im Aktivitätslog gespeichert)…"
    >
      {!contact ? <p style={{ fontSize: 12 }}>Kontakt nicht gefunden.</p> : null}
      {log.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Noch keine Nachrichten. Schreib die erste — landet im Lead-Aktivitätslog.
        </p>
      ) : null}
      {[...log].reverse().map((entry) => (
        <ChatBubble
          key={entry.id}
          mine={entry.text.startsWith(`${senderName}:`)}
          author={entry.text.startsWith(`${senderName}:`) ? 'Du' : threadLabel}
          body={entry.text.includes(': ') ? entry.text.split(': ').slice(1).join(': ') : entry.text}
        />
      ))}
    </ThreadShell>
  )
}

function ThreadShell({
  title,
  subtitle,
  onBack,
  onOpenDetail,
  detailLabel,
  children,
  draft,
  onDraftChange,
  onSend,
  sending,
  placeholder,
}: {
  title: string
  subtitle: string
  onBack: () => void
  onOpenDetail: () => void
  detailLabel: string
  children: ReactNode
  draft: string
  onDraftChange: (v: string) => void
  onSend: () => void
  sending: boolean
  placeholder: string
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--glass-border-2)] px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" className="font-mono" style={{ fontSize: 11 }} onClick={onBack}>
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
            <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              {subtitle}
            </div>
          </div>
          <button
            type="button"
            className="font-mono shrink-0"
            style={{ fontSize: 10, color: 'var(--accent-teal)' }}
            onClick={onOpenDetail}
          >
            {detailLabel}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">{children}</div>
      <div className="flex gap-2 border-t border-[var(--glass-border-2)] p-2">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="flex-1 rounded-lg px-2 py-1"
          style={{
            fontSize: 13,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--text-primary)',
            resize: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          className="rounded-lg px-3"
          style={{ background: 'var(--accent-teal)', color: '#0a0a12', fontSize: 12 }}
          onClick={onSend}
        >
          ↑
        </button>
      </div>
    </div>
  )
}

function ChatBubble({
  mine,
  author,
  body,
}: {
  mine: boolean
  author: string
  body: string
}) {
  return (
    <div className="mb-2" style={{ textAlign: mine ? 'right' : 'left' }}>
      <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        {author}
      </div>
      <p
        style={{
          display: 'inline-block',
          fontSize: 13,
          color: 'var(--text-primary)',
          background: mine ? 'color-mix(in srgb, var(--accent-teal) 18%, var(--glass-2))' : 'var(--glass-1)',
          borderRadius: 10,
          padding: '8px 10px',
          marginTop: 2,
          maxWidth: '92%',
          textAlign: 'left',
        }}
      >
        {body}
      </p>
    </div>
  )
}
