import { useEffect, useState } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type {
  DiscoveryAnalysis,
  DiscoveryFoundationDoc,
  DiscoveryIcpDraft,
  DiscoveryWordSuggestion,
} from '../../types/db'

const FIELD_STYLE = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  lineHeight: 1.5,
  padding: '10px 12px',
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  resize: 'vertical' as const,
  width: '100%' as const,
  minHeight: 88,
  borderRadius: 12,
}

interface DiscoveryFoundationSectionProps {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  onSave: (
    patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>,
  ) => void
  onRunAnalysis: () => void
  onApplyIcpDraft: (draft: DiscoveryIcpDraft) => void
  onApplyWord: (s: DiscoveryWordSuggestion) => void
  onApplyPositioningIdea: (idea: string) => void
}

function formatAnalysisTime(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function AnalysisPanel({
  analysis,
  analysisRunAt,
  onApplyIcpDraft,
  onApplyWord,
  onApplyPositioningIdea,
}: {
  analysis: DiscoveryAnalysis
  analysisRunAt: string | null
  onApplyIcpDraft: (draft: DiscoveryIcpDraft) => void
  onApplyWord: (s: DiscoveryWordSuggestion) => void
  onApplyPositioningIdea: (idea: string) => void
}) {
  return (
    <div
      style={{
        marginTop: 20,
        padding: 18,
        borderRadius: 16,
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-2)',
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent-coral)',
          }}
        >
          Analyse (Mock)
        </span>
        {analysisRunAt ? (
          <span
            className="font-mono"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            {formatAnalysisTime(analysisRunAt)}
          </span>
        ) : null}
      </div>

      <p
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginTop: 10,
          marginBottom: 16,
        }}
      >
        Vorschläge für Building. Später ersetzt ein Agent diese Auswertung.
      </p>

      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        ICP-Entwürfe
      </div>
      <ul className="flex flex-col gap-3" style={{ marginBottom: 20 }}>
        {analysis.icp_drafts.map((d, i) => (
          <li
            key={i}
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              {d.name}
            </div>
            {d.pain_hint ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {d.pain_hint}
              </p>
            ) : null}
            <button
              type="button"
              className="font-mono"
              style={{
                marginTop: 10,
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'var(--glass-3)',
                border: '1px solid var(--glass-border-2)',
                color: 'var(--accent-coral)',
              }}
              onClick={() => onApplyIcpDraft(d)}
            >
              Als ICP in Building anlegen
            </button>
          </li>
        ))}
      </ul>

      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        Word Bank
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 20 }}>
        {analysis.word_bank_suggestions.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 6,
                background:
                  s.type === 'yes'
                    ? 'rgba(45, 212, 191, 0.15)'
                    : 'rgba(249, 115, 22, 0.15)',
                color:
                  s.type === 'yes' ? 'var(--accent-teal)' : 'var(--accent-coral)',
              }}
            >
              {s.type === 'yes' ? 'Ja' : 'Nein'}
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>
              {s.word}
            </span>
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 10,
                marginLeft: 4,
                padding: '4px 8px',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border-1)',
              }}
              onClick={() => onApplyWord(s)}
            >
              Übernehmen
            </button>
          </div>
        ))}
      </div>

      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        Positioning-Ideen
      </div>
      <ul className="flex flex-col gap-2">
        {analysis.positioning_ideas.map((idea, i) => (
          <li
            key={i}
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              paddingLeft: 14,
              borderLeft: '2px solid var(--accent-coral)',
            }}
          >
            <p style={{ marginBottom: 8 }}>{idea}</p>
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'var(--glass-3)',
                border: '1px solid var(--glass-border-2)',
                color: 'var(--accent-coral)',
              }}
              onClick={() => onApplyPositioningIdea(idea)}
            >
              Statement setzen / kopieren
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DiscoveryFoundationSection({
  item,
  loading,
  error,
  onSave,
  onRunAnalysis,
  onApplyIcpDraft,
  onApplyWord,
  onApplyPositioningIdea,
}: DiscoveryFoundationSectionProps) {
  const [market, setMarket] = useState(item?.market ?? '')
  const [competitors, setCompetitors] = useState(item?.competitors ?? '')
  const [niche, setNiche] = useState(item?.niche ?? '')

  useEffect(() => {
    setMarket(item?.market ?? '')
    setCompetitors(item?.competitors ?? '')
    setNiche(item?.niche ?? '')
  }, [item?.id, item?.market, item?.competitors, item?.niche])

  const debouncedMarket = useDebouncedCallback((v: string) =>
    onSave({ market: v }),
  )
  const debouncedCompetitors = useDebouncedCallback((v: string) =>
    onSave({ competitors: v }),
  )
  const debouncedNiche = useDebouncedCallback((v: string) =>
    onSave({ niche: v }),
  )

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 280,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        Discovery Foundation konnte nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520 }}>
          Markt, Wettbewerb und Nische — einmal sauber festhalten. Die Analyse
          liefert Vorschläge für ICPs, Word Bank und Positioning.
        </p>
        <button
          type="button"
          className="font-mono shrink-0"
          style={{
            fontSize: 12,
            padding: '10px 16px',
            borderRadius: 12,
            background: 'var(--glass-3)',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--accent-coral)',
          }}
          onClick={onRunAnalysis}
        >
          Analyse ausführen
        </button>
      </div>

      <label className="mt-6 block" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Markt / Kontext
        <textarea
          value={market}
          onChange={(e) => {
            setMarket(e.target.value)
            debouncedMarket(e.target.value)
          }}
          placeholder="z. B. B2B SaaS DACH, lokale Dienstleister, Premium-Consumer …"
          rows={4}
          className="mt-2 block"
          style={FIELD_STYLE}
        />
      </label>

      <label className="mt-4 block" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Wettbewerber (Freitext)
        <textarea
          value={competitors}
          onChange={(e) => {
            setCompetitors(e.target.value)
            debouncedCompetitors(e.target.value)
          }}
          placeholder="Namen, Links oder Beobachtungen — was dir im Feed auffällt."
          rows={4}
          className="mt-2 block"
          style={FIELD_STYLE}
        />
      </label>

      <label className="mt-4 block" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Nische / Schwerpunkt
        <textarea
          value={niche}
          onChange={(e) => {
            setNiche(e.target.value)
            debouncedNiche(e.target.value)
          }}
          placeholder="Worin du dich von „alle machen das gleiche“ abhebst."
          rows={4}
          className="mt-2 block"
          style={FIELD_STYLE}
        />
      </label>

      {item?.analysis ? (
        <AnalysisPanel
          analysis={item.analysis}
          analysisRunAt={item.analysis_run_at}
          onApplyIcpDraft={onApplyIcpDraft}
          onApplyWord={onApplyWord}
          onApplyPositioningIdea={onApplyPositioningIdea}
        />
      ) : (
        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: 'var(--text-tertiary)',
          }}
        >
          Noch keine Analyse. Felder ausfüllen und „Analyse ausführen“ wählen.
        </p>
      )}
    </div>
  )
}
