import type { ComponentType } from 'react'
import { BrandDashboardModule } from './brand/BrandDashboardModule'
import { DeliverProjectModule } from './deliver/DeliverProjectModule'
import { DeliverWorkspaceModule } from './deliver/DeliverWorkspaceModule'
import { PromoCalendarModule } from './promo/PromoCalendarModule'
import { PromoCampaignsModule } from './promo/PromoCampaignsModule'
import { PromoPiecesModule } from './promo/PromoPiecesModule'
import { PromoWorkspaceModule } from './promo/PromoWorkspaceModule'
import { ContactDetailModule } from './sales/ContactDetailModule'
import { SalesListDetailModule } from './sales/SalesListDetailModule'
import { SalesListsModule } from './sales/SalesListsModule'
import { PipelineModule } from './sales/PipelineModule'
import { QuickStatsModule } from './sales/QuickStatsModule'
import { TasksModule } from './sales/TasksModule'
import { OutletHostModule } from './workspace/OutletHostModule'

export interface ModuleRenderProps {
  data?: unknown
}

export type ModuleComponent = ComponentType<ModuleRenderProps>

/**
 * Typ → Komponente (Sales, Intelligence, Promo, Workspace-Outlet).
 */
export const MODULE_REGISTRY: Record<string, ModuleComponent> = {
  'workspace-outlet': OutletHostModule,
  'brand-dashboard': BrandDashboardModule,
  'deliver-project': DeliverProjectModule,
  'deliver-workspace': DeliverWorkspaceModule,
  pipeline: PipelineModule,
  'sales-lists': SalesListsModule,
  'sales-list-detail': SalesListDetailModule,
  tasks: TasksModule,
  'quick-stats': QuickStatsModule,
  'contact-detail': ContactDetailModule,
  'promo-calendar': PromoCalendarModule,
  'promo-main': PromoCalendarModule,
  'promo-pieces': PromoPiecesModule,
  'promo-campaigns': PromoCampaignsModule,
  'promo-workspace': PromoWorkspaceModule,
}

export function getModuleComponent(type: string): ModuleComponent | null {
  return MODULE_REGISTRY[type] ?? null
}
