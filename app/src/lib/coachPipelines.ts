import type { PipelineStageDef } from '../types/db'

/**
 * Coach-Pipeline-Presets (Agentur Inkubator / Marcel Steljes, 2-Pipeline-Prinzip
 * + vorgelagerte Kaltakquise). Bewusst auf die vorhandenen, DB-check-erlaubten
 * Stage-Keys gemappt (first_contact · conversation · follow_up · proposal · deal ·
 * paused) — nur die LABELS sprechen die Coach-Sprache. Dadurch echte, umschaltbare
 * Pipelines ohne DB-Migration; Leads „wandern" per pipeline_id von Kaltakquise →
 * Loom → Sales.
 *
 * Siehe Vault: „ClientOS - Agentur Inkubator/10 Tracking & CRM (2 Pipelines)".
 */
export interface CoachPipelinePreset {
  name: string
  slug: string
  stages: PipelineStageDef[]
}

const BLUE = '#60a5fa'
const AMBER = '#fbbf24'
const GREEN = '#34d399'
const GREY = '#64748b'

export const COACH_PIPELINE_PRESETS: CoachPipelinePreset[] = [
  {
    name: 'Kaltakquise',
    slug: 'kaltakquise',
    stages: [
      { key: 'first_contact', label: 'Erstkontakt', accent: BLUE },
      { key: 'conversation', label: 'Im Chat', accent: BLUE },
      { key: 'paused', label: 'Kalt / später', accent: GREY },
    ],
  },
  {
    name: 'Loom-Pipeline',
    slug: 'loom',
    stages: [
      { key: 'first_contact', label: 'Loom offen', accent: AMBER },
      { key: 'conversation', label: 'Loom gesendet', accent: AMBER },
      { key: 'follow_up', label: 'Follow-up (Chat/Mail)', accent: AMBER },
      { key: 'paused', label: 'Pausiert', accent: GREY },
    ],
  },
  {
    name: 'Sales-Pipeline',
    slug: 'sales',
    stages: [
      { key: 'proposal', label: 'Quali/Sales-Call', accent: GREEN },
      { key: 'deal', label: 'Kunde', accent: GREEN, won: true },
      { key: 'paused', label: 'Kein Abschluss', accent: GREY, lost: true },
    ],
  },
]
