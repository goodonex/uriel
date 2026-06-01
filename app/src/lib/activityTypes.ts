export const ACTIVITY_TYPES = [
  'presetting',
  'setting',
  'closing',
  'terminierung',
  'unqualified',
  'noshow',
  'followup',
  'formular',
  'notiz',
  'call',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type ActivityModalType =
  | ActivityType
  | 'termin' // shortcut → terminierung

export const ACTIVITY_META: Record<
  ActivityType,
  { label: string; icon: string; color: string; category: 'gespraech' | 'wichtig' | 'notiz' | 'other' }
> = {
  presetting: { label: 'Presetting', icon: '📋', color: 'var(--accent-blue)', category: 'gespraech' },
  setting: { label: 'Setting', icon: '🤝', color: 'var(--accent-teal)', category: 'gespraech' },
  closing: { label: 'Closing', icon: '✅', color: 'var(--mode-sales)', category: 'wichtig' },
  terminierung: { label: 'Terminierung', icon: '📅', color: '#eab308', category: 'wichtig' },
  unqualified: { label: 'Unqualified', icon: '🚫', color: 'var(--accent-coral)', category: 'wichtig' },
  noshow: { label: 'NoShow / Absage', icon: '❌', color: '#f97316', category: 'wichtig' },
  followup: { label: 'Follow Up', icon: '⚑', color: '#f97316', category: 'other' },
  formular: { label: 'Formular', icon: '📄', color: 'var(--text-tertiary)', category: 'other' },
  notiz: { label: 'Notiz', icon: '💬', color: 'var(--text-secondary)', category: 'notiz' },
  call: { label: 'Anruf', icon: '☎', color: 'var(--mode-sales)', category: 'gespraech' },
}

export type TimelineFilter = 'all' | 'wichtig' | 'gespraeche' | 'notizen'

export const DROPDOWN_ACTIVITIES: Array<{ type: ActivityType; dividerBefore?: boolean }> = [
  { type: 'presetting' },
  { type: 'setting' },
  { type: 'closing' },
  { type: 'terminierung', dividerBefore: true },
  { type: 'unqualified' },
  { type: 'noshow' },
  { type: 'followup' },
  { type: 'formular' },
]
