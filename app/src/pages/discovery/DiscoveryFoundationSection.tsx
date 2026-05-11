import { useEffect, useState } from 'react'
import { InlineEditableCard } from '../../components/InlineEditableCard'
import type {
  DiscoveryAnalysis,
  DiscoveryFoundationDoc,
  DiscoveryIcpDraft,
  DiscoveryWordSuggestion,
} from '../../types/db'

const PHASE_LABELS = [
  'Markt wird analysiert…',
  'Muster werden erkannt…',
  'Ergebnisse werden gespeichert…',
]

interface DiscoveryFoundationSectionProps {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  onSave: (
    patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>,
  ) => void
  onRunAnalysis: (payload: {
    market: string
    competitors: string
    niche: string
  }) => void | Promise<void>
  analysisRunBusy: boolean
  analysisRunPhase: number
  analysisRunError: string | null
  onDismissAnalysisError: () => void
  onApplyIcpDraft: (draft: DiscoveryIcpDraft) => void
  onApplyAllIcpDrafts: (drafts: DiscoveryIcpDraft[]) => void
  onApplyWord: (s: DiscoveryWordSuggestion) => void
  onApplyAllWords: (list: DiscoveryWordSuggestion[]) => void
  onApplyPositioningIdea: (idea: string) => void
  onApplyToneOfVoice: (text: string) => void
  onSyncFromBuilding: () => void
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

function AnalysisRunProgress({
  phaseIndex,
  busy,
}: {
  phaseIndex: number
  busy: boolean
}) {
  if (!busy) return null
  const p = Math.min(Math.max(phaseIndex, 0), 2)
  const pct = ((p + 1) / 3) * 100
  return (
    <div style={{ width: '100%', maxWidth: 420, marginTop: 12 }}>
      <div
        className="font-mono"
        style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}
      >
        {PHASE_LABELS[p]}
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-coral))',
            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  )
}

function AnalysisPanel({
  analysis,
  analysisRunAt,
  onApplyIcpDraft,
  onApplyAllIcpDrafts,
  onApplyWord,
  onApplyAllWords,
  onApplyPositioningIdea,
  onApplyToneOfVoice,
}: {
  analysis: DiscoveryAnalysis
  analysisRunAt: string | null
  onApplyIcpDraft: (draft: DiscoveryIcpDraft) => void
  onApplyAllIcpDrafts: (drafts: DiscoveryIcpDraft[]) => void
  onApplyWord: (s: DiscoveryWordSuggestion) => void
  onApplyAllWords: (list: DiscoveryWordSuggestion[]) => void
  onApplyPositioningIdea: (idea: string) => void
  onApplyToneOfVoice: (text: string) => void
}) {
  const icpDrafts = analysis.icp_drafts ?? []
  const wordSuggestions = analysis.word_bank_suggestions ?? []
  const positioningIdeas = analysis.positioning_ideas ?? []
  const comps = analysis.competitor_insights ?? []
  const formats = analysis.content_formats ?? []
  const tone = analysis.tone_of_voice?.trim()

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
          Analyse
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
        Aus Web-Research (Perplexity) und Strukturierung (Claude). Übernehme nach Bedarf in
        Building.
      </p>

      {comps.length ? (
        <>
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
            Wettbewerber-Insights
          </div>
          <ul className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
            {comps.slice(0, 6).map((c, i) => (
              <li
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-1)',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <div
                  className="font-display"
                  style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}
                >
                  {c.headline}
                </div>
                {c.detail ? <p style={{ margin: 0 }}>{c.detail}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {formats.length ? (
        <>
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
            Content-Formate (performant)
          </div>
          <ul className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
            {formats.map((f, i) => (
              <li
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-1)',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>{f.format_name}</strong>
                {f.rationale ? (
                  <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>
                    {f.rationale}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {tone ? (
        <div style={{ marginBottom: 20 }}>
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
            Tone of Voice
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10 }}>{tone}</p>
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
            onClick={() => onApplyToneOfVoice(tone)}
          >
            In Building übernehmen
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 8 }}>
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          ICP-Entwürfe
        </div>
        {icpDrafts.length ? (
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-1)',
              color: 'var(--accent-teal)',
              background: 'transparent',
            }}
            onClick={() => onApplyAllIcpDrafts(icpDrafts)}
          >
            Alle ICPs übernehmen
          </button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-3" style={{ marginBottom: 20 }}>
        {icpDrafts.map((d, i) => (
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
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{d.pain_hint}</p>
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
              Übernehmen
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 8 }}>
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Word Bank
        </div>
        {wordSuggestions.length ? (
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-1)',
              color: 'var(--accent-teal)',
              background: 'transparent',
            }}
            onClick={() => onApplyAllWords(wordSuggestions)}
          >
            Alle Wörter übernehmen
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" style={{ marginBottom: 20 }}>
        {wordSuggestions.map((s, i) => (
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
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.word}</span>
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
        Positioning
      </div>
      <ul className="flex flex-col gap-2">
        {positioningIdeas.map((idea, i) => (
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
              Übernehmen
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
  analysisRunBusy,
  analysisRunPhase,
  analysisRunError,
  onDismissAnalysisError,
  onApplyIcpDraft,
  onApplyAllIcpDrafts,
  onApplyWord,
  onApplyAllWords,
  onApplyPositioningIdea,
  onApplyToneOfVoice,
  onSyncFromBuilding,
}: DiscoveryFoundationSectionProps) {
  const [market, setMarket] = useState(item?.market ?? '')
  const [competitors, setCompetitors] = useState(item?.competitors ?? '')
  const [niche, setNiche] = useState(item?.niche ?? '')

  useEffect(() => {
    setMarket(item?.market ?? '')
    setCompetitors(item?.competitors ?? '')
    setNiche(item?.niche ?? '')
  }, [item?.id, item?.market, item?.competitors, item?.niche])

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
      <div className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
        Discovery Foundation konnte nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520 }}>
          Markt, Wettbewerb und Nische — einmal sauber festhalten. Die Analyse nutzt Web-Research
          und ein KI-Modell für strukturierte Vorschläge (ICPs, Word Bank, Positioning).
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <button
            type="button"
            className="font-mono inline-flex items-center gap-1.5"
            style={{
              fontSize: 11,
              letterSpacing: '0.04em',
              padding: '9px 14px',
              borderRadius: 10,
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            onClick={onSyncFromBuilding}
            title="Felder mit Daten aus dem Building-Modus vorbefüllen"
          >
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M3 8 a5 5 0 0 1 9 -3 L13 6" strokeLinecap="round" />
              <path d="M13 8 a5 5 0 0 1 -9 3 L3 10" strokeLinecap="round" />
              <path d="M11 3 L13 6 L10 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 13 L3 10 L6 10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Aus Building übernehmen
          </button>
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'var(--glass-3)',
              border: '1px solid var(--glass-border-2)',
              color: 'var(--accent-coral)',
              opacity: analysisRunBusy ? 0.65 : 1,
              pointerEvents: analysisRunBusy ? 'none' : 'auto',
            }}
            disabled={analysisRunBusy}
            onClick={() =>
              void onRunAnalysis({ market, competitors, niche })
            }
          >
            {analysisRunBusy ? 'Analyse läuft…' : 'Analyse ausführen'}
          </button>
          <AnalysisRunProgress phaseIndex={analysisRunPhase} busy={analysisRunBusy} />
        </div>
      </div>

      {analysisRunError ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            background: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.35)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div className="flex justify-between gap-2">
            <span className="font-mono" style={{ color: 'var(--accent-coral)', fontSize: 11 }}>
              Fehler
            </span>
            <button
              type="button"
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              onClick={onDismissAnalysisError}
            >
              Schließen
            </button>
          </div>
          <p style={{ margin: '8px 0 0' }}>{analysisRunError}</p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        <InlineEditableCard
          label="Markt / Kontext"
          hint="Wo spielt diese Brand?"
          value={market}
          placeholder="z. B. B2B SaaS DACH, lokale Dienstleister, Premium-Consumer …"
          onSave={(v) => {
            setMarket(v)
            onSave({ market: v })
          }}
          accent="var(--accent-coral)"
          toast="Markt gespeichert"
        />
        <InlineEditableCard
          label="Wettbewerber"
          hint="Namen · Links · Beobachtungen"
          value={competitors}
          placeholder="Namen, Links oder Beobachtungen — was dir im Feed auffällt."
          onSave={(v) => {
            setCompetitors(v)
            onSave({ competitors: v })
          }}
          accent="var(--accent-coral)"
          toast="Wettbewerber gespeichert"
        />
        <InlineEditableCard
          label="Nische / Schwerpunkt"
          hint="Worin hebt ihr euch ab?"
          value={niche}
          placeholder="Worin du dich von „alle machen das gleiche“ abhebst."
          onSave={(v) => {
            setNiche(v)
            onSave({ niche: v })
          }}
          accent="var(--accent-coral)"
          toast="Nische gespeichert"
        />
      </div>

      {item?.analysis ? (
        <AnalysisPanel
          analysis={item.analysis}
          analysisRunAt={item.analysis_run_at}
          onApplyIcpDraft={onApplyIcpDraft}
          onApplyAllIcpDrafts={onApplyAllIcpDrafts}
          onApplyWord={onApplyWord}
          onApplyAllWords={onApplyAllWords}
          onApplyPositioningIdea={onApplyPositioningIdea}
          onApplyToneOfVoice={onApplyToneOfVoice}
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
