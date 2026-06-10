import type { BusinessTarget, BusinessTargetMilestone, DailyMetricTargets } from '../types/db'

export const DEFAULT_DAILY_TARGETS: Omit<
  DailyMetricTargets,
  'id' | 'brand_id' | 'created_at' | 'updated_at'
> = {
  dial_attempts_target: 50,
  linkedin_target: 30,
  pitches_target: 5,
}

export const H2_2026_MILESTONES: BusinessTargetMilestone[] = [
  {
    id: 'q3-sales-machine',
    label: 'Vertriebsmaschine läuft',
    quarter: 'Q3',
    target_date: '2026-07-01',
  },
  {
    id: 'q3-first-sales-rep',
    label: 'Erster Vertriebler (Provision)',
    quarter: 'Q3',
    target_date: '2026-09-01',
  },
  {
    id: 'q4-ads',
    label: 'Ads kontrolliert freischalten',
    quarter: 'Q4',
    target_date: '2026-10-01',
  },
  {
    id: 'q4-8k-mrr',
    label: '8k-MRR-Schwelle',
    quarter: 'Q4',
    target_date: '2026-11-30',
  },
]

export const DEFAULT_H2_2026_TARGETS: Omit<
  BusinessTarget,
  'id' | 'brand_id' | 'created_at' | 'updated_at'
> = {
  period_label: 'H2 2026',
  north_star_mrr: 8000,
  north_star_deadline: '2026-11-30',
  mrr_dec_target: 11000,
  total_revenue_target: 168000,
  new_customers_target: 24,
  margin_min: 65,
  margin_max: 75,
  hire_trigger_mrr: 8000,
  hire_trigger_profit: 10000,
  milestones: H2_2026_MILESTONES,
}
