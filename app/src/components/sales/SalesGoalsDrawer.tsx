import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useBusinessTargets } from '../../hooks/useBusinessTargets'
import { useDailyMetricTargets } from '../../hooks/useDailyMetricTargets'
import { useSalesGoals } from '../../hooks/useSalesPro'
import { useToast } from '../Toast'

type GoalsTab = 'daily' | 'weekly' | 'strategic'

interface SalesGoalsDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
  initialTab?: GoalsTab
}

export function SalesGoalsDrawer({
  open,
  onClose,
  brandSlug,
  initialTab = 'daily',
}: SalesGoalsDrawerProps) {
  const weekGoals = useSalesGoals(brandSlug, 'week')
  const dailyTargets = useDailyMetricTargets(brandSlug)
  const businessTargets = useBusinessTargets(brandSlug)
  const { show } = useToast()
  const [tab, setTab] = useState<GoalsTab>(initialTab)

  const [weekDraft, setWeekDraft] = useState({
    calls: 0,
    mails: 0,
    linkedin: 0,
    qualifications: 0,
    meetings: 0,
    deals: 0,
  })

  const [dailyDraft, setDailyDraft] = useState({
    dial: 50,
    linkedin: 30,
    pitches: 5,
  })

  const [strategicDraft, setStrategicDraft] = useState({
    northStarMrr: 8000,
    northStarDeadline: '2026-11-30',
    mrrDec: 11000,
    totalRevenue: 168000,
    newCustomers: 24,
    hireMrr: 8000,
    hireProfit: 10000,
  })

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    setWeekDraft({
      calls: weekGoals.current?.calls_target ?? 0,
      mails: weekGoals.current?.mails_target ?? 0,
      linkedin: weekGoals.current?.linkedin_target ?? 0,
      qualifications: weekGoals.current?.qualifications_target ?? 0,
      meetings: weekGoals.current?.meetings_target ?? 0,
      deals: weekGoals.current?.deals_target ?? 0,
    })
    setDailyDraft({
      dial: dailyTargets.current?.dial_attempts_target ?? 50,
      linkedin: dailyTargets.current?.linkedin_target ?? 30,
      pitches: dailyTargets.current?.pitches_target ?? 5,
    })
    const bt = businessTargets.current
    if (bt) {
      setStrategicDraft({
        northStarMrr: bt.north_star_mrr,
        northStarDeadline: bt.north_star_deadline,
        mrrDec: bt.mrr_dec_target,
        totalRevenue: bt.total_revenue_target,
        newCustomers: bt.new_customers_target,
        hireMrr: bt.hire_trigger_mrr,
        hireProfit: bt.hire_trigger_profit,
      })
    }
  }, [open, initialTab, weekGoals.current, dailyTargets.current, businessTargets.current])

  const handleSave = async () => {
    if (tab === 'daily') {
      await dailyTargets.upsert({
        dial_attempts_target: dailyDraft.dial,
        linkedin_target: dailyDraft.linkedin,
        pitches_target: dailyDraft.pitches,
      })
    } else if (tab === 'weekly') {
      await weekGoals.upsert({
        calls_target: weekDraft.calls,
        mails_target: weekDraft.mails,
        linkedin_target: weekDraft.linkedin,
        qualifications_target: weekDraft.qualifications,
        meetings_target: weekDraft.meetings,
        deals_target: weekDraft.deals,
      })
    } else {
      await businessTargets.upsert({
        north_star_mrr: strategicDraft.northStarMrr,
        north_star_deadline: strategicDraft.northStarDeadline,
        mrr_dec_target: strategicDraft.mrrDec,
        total_revenue_target: strategicDraft.totalRevenue,
        new_customers_target: strategicDraft.newCustomers,
        hire_trigger_mrr: strategicDraft.hireMrr,
        hire_trigger_profit: strategicDraft.hireProfit,
      })
    }
    show('Ziele gespeichert', 'success')
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
          style={{ background: 'var(--overlay-backdrop)', backdropFilter: 'blur(8px)' }}
        >
          <motion.aside
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="font-body"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 480,
              background: 'var(--surface-drawer)',
              borderLeft: '1px solid var(--glass-border-2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border-1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
                  >
                    PERFORMANCE · ZIELE
                  </div>
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
                    H2 2026
                  </div>
                </div>
                <button type="button" onClick={onClose} className="font-mono" style={escBtn}>
                  Esc
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {(
                  [
                    ['daily', 'Täglich'],
                    ['weekly', 'Wöchentlich'],
                    ['strategic', 'Strategisch'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '5px 10px',
                      borderRadius: 7,
                      border: `1px solid ${tab === key ? 'var(--mode-sales)' : 'var(--glass-border-2)'}`,
                      background:
                        tab === key
                          ? 'color-mix(in srgb, var(--mode-sales) 18%, transparent)'
                          : 'transparent',
                      color: tab === key ? 'var(--mode-sales)' : 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>

            <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
              {tab === 'daily' ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                    Die 6 Zahlen — Targets für Wählversuche, LinkedIn und Pitches.
                  </p>
                  <NumField label="Wählversuche / Tag" value={dailyDraft.dial} onChange={(v) => setDailyDraft((d) => ({ ...d, dial: v }))} />
                  <NumField label="LinkedIn / Tag" value={dailyDraft.linkedin} onChange={(v) => setDailyDraft((d) => ({ ...d, linkedin: v }))} />
                  <NumField label="Pitches / Tag" value={dailyDraft.pitches} onChange={(v) => setDailyDraft((d) => ({ ...d, pitches: v }))} />
                </>
              ) : null}

              {tab === 'weekly' ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                    Wochenziele für Sales-Aktivität (Dashboard GoalsCard).
                  </p>
                  <NumField label="Anrufe" value={weekDraft.calls} onChange={(v) => setWeekDraft((d) => ({ ...d, calls: v }))} />
                  <NumField label="E-Mails" value={weekDraft.mails} onChange={(v) => setWeekDraft((d) => ({ ...d, mails: v }))} />
                  <NumField label="LinkedIn" value={weekDraft.linkedin} onChange={(v) => setWeekDraft((d) => ({ ...d, linkedin: v }))} />
                  <NumField label="Qualifizierungen" value={weekDraft.qualifications} onChange={(v) => setWeekDraft((d) => ({ ...d, qualifications: v }))} />
                  <NumField label="Erstgespräche" value={weekDraft.meetings} onChange={(v) => setWeekDraft((d) => ({ ...d, meetings: v }))} />
                  <NumField label="Abschlüsse" value={weekDraft.deals} onChange={(v) => setWeekDraft((d) => ({ ...d, deals: v }))} />
                </>
              ) : null}

              {tab === 'strategic' ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                    Nordstern und H2-Finanzziele. Gewinn/Marge folgt mit Lexoffice.
                  </p>
                  <NumField label="Nordstern MRR (€)" value={strategicDraft.northStarMrr} onChange={(v) => setStrategicDraft((d) => ({ ...d, northStarMrr: v }))} />
                  <DateField label="Nordstern Deadline" value={strategicDraft.northStarDeadline} onChange={(v) => setStrategicDraft((d) => ({ ...d, northStarDeadline: v }))} />
                  <NumField label="MRR Dezember (€)" value={strategicDraft.mrrDec} onChange={(v) => setStrategicDraft((d) => ({ ...d, mrrDec: v }))} />
                  <NumField label="Gesamtumsatz H2 (€)" value={strategicDraft.totalRevenue} onChange={(v) => setStrategicDraft((d) => ({ ...d, totalRevenue: v }))} />
                  <NumField label="Neukunden gesamt" value={strategicDraft.newCustomers} onChange={(v) => setStrategicDraft((d) => ({ ...d, newCustomers: v }))} />
                  <NumField label="Hire-Trigger MRR (€)" value={strategicDraft.hireMrr} onChange={(v) => setStrategicDraft((d) => ({ ...d, hireMrr: v }))} />
                  <NumField label="Hire-Trigger Gewinn (€)" value={strategicDraft.hireProfit} onChange={(v) => setStrategicDraft((d) => ({ ...d, hireProfit: v }))} />
                </>
              ) : null}
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button type="button" onClick={() => void handleSave()} className="font-mono" style={saveBtn}>
                Speichern
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="font-mono" style={btnStyle}>−</button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 10px',
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-1)',
            color: 'var(--text-primary)',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            outline: 'none',
          }}
        />
        <button type="button" onClick={() => onChange(value + 1)} className="font-mono" style={btnStyle}>+</button>
      </div>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-1)',
          color: 'var(--text-primary)',
          fontSize: 14,
          borderRadius: 8,
          outline: 'none',
        }}
      />
    </div>
  )
}

const escBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 10px',
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
}

const saveBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid var(--mode-sales)',
  background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
  color: 'var(--mode-sales)',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  fontSize: 18,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
}
