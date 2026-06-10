import { useState } from 'react'
import { PerformanceCommandCenter } from './PerformanceCommandCenter'
import { PerformanceDrawerProvider } from './PerformanceDrawerContext'
import { WeeklyReviewDrawer } from './WeeklyReviewDrawer'
import { SalesGoalsDrawer } from '../sales/SalesGoalsDrawer'
import { usePerformanceFocusTasks } from '../../hooks/usePerformanceFocusTasks'

interface PerformanceTrackingSectionProps {
  slug: string
  /** Kompakte Darstellung für Scroll-Flow-Sidebar */
  compact?: boolean
}

export function PerformanceTrackingSection({
  slug,
  compact = false,
}: PerformanceTrackingSectionProps) {
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  usePerformanceFocusTasks(slug)

  const drawerValue = {
    openGoals: () => setGoalsOpen(true),
    openReview: () => setReviewOpen(true),
  }

  return (
    <PerformanceDrawerProvider value={drawerValue}>
      <PerformanceCommandCenter
        slug={slug}
        compact={compact}
        onOpenSettings={drawerValue.openGoals}
        onOpenReview={drawerValue.openReview}
      />
      <SalesGoalsDrawer
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        brandSlug={slug}
      />
      <WeeklyReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        brandSlug={slug}
      />
    </PerformanceDrawerProvider>
  )
}
