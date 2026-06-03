import type { OpportunityProduct, OpportunityStage } from '../types/db'

export const OPPORTUNITY_PRODUCTS: OpportunityProduct[] = ['herrmann', 'wertavio', 'culturefit']

export const OPPORTUNITY_PRODUCT_META: Record<
  OpportunityProduct,
  { label: string; color: string; bg: string }
> = {
  herrmann: {
    label: 'Herrmann & Co',
    color: 'var(--mode-sales)',
    bg: 'color-mix(in srgb, var(--mode-sales) 12%, transparent)',
  },
  wertavio: {
    label: 'Wertavio',
    color: 'var(--accent-blue)',
    bg: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
  },
  culturefit: {
    label: 'CultureFit',
    color: '#DC4628',
    bg: 'color-mix(in srgb, #DC4628 14%, transparent)',
  },
}

export const OPPORTUNITY_MAIN_STAGES: OpportunityStage[] = [
  'erstkontakt',
  'gespraech',
  'pitch',
  'deal',
]

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  erstkontakt: 'Erstkontakt',
  gespraech: 'Gespräch',
  pitch: 'Pitch',
  deal: 'Deal',
  pause: 'Pause',
  verloren: 'Verloren',
}
