import type { CSSProperties } from 'react'
import { BRAND_FLOAT_MAIN_LEFT_X } from '../components/BrandWorkspaceSidebar'

export type ModuleSlot =
  | 'main'
  | 'side-top'
  | 'side-bottom'
  | 'overlay-center'
  | 'overlay-right'

/** Slots, in denen nur eine Instanz gleichzeitig erlaubt ist (neu ersetzt alt). */
export const SINGLETON_SLOTS: ModuleSlot[] = [
  'main',
  'side-top',
  'side-bottom',
]

export const OVERLAY_SLOTS: ModuleSlot[] = ['overlay-center', 'overlay-right']

const Z = {
  main: 50,
  side: 55,
  overlay: 80,
} as const

/**
 * Breite `overlay-right` (z. B. Kontakt-Detail).
 * 640px: Labels, E-Mail, Datumsfelder und Flow-Auswahl bleiben lesbar (vgl. Phase-5-Review).
 */
export const OVERLAY_RIGHT_WIDTH_PX = 640

/** Abstand zwischen rechter Kante des `main`-Moduls und linker Kante des Overlays */
const MAIN_OVERLAY_GAP_PX = 24
const VIEWPORT_RIGHT_INSET_PX = 32
/** Rechte Spalte (Tasks + KPI) + Puffer — wenn kein `overlay-right` offen ist */
const SIDE_COLUMN_WIDTH_PX = 380
const MAIN_RESERVE_RIGHT_BASE_PX = SIDE_COLUMN_WIDTH_PX + 56

export interface MainSlotStyleOptions {
  hasOverlayRight: boolean
}

export function mainSlotStyle(
  stackIndex: number,
  opts: MainSlotStyleOptions,
): CSSProperties {
  const reserveRight = opts.hasOverlayRight
    ? OVERLAY_RIGHT_WIDTH_PX + VIEWPORT_RIGHT_INSET_PX + MAIN_OVERLAY_GAP_PX
    : MAIN_RESERVE_RIGHT_BASE_PX
  return {
    position: 'fixed',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
    top: 32,
    left: BRAND_FLOAT_MAIN_LEFT_X,
    width: `min(52vw, calc(100vw - ${BRAND_FLOAT_MAIN_LEFT_X}px - ${reserveRight}px))`,
    maxWidth: `calc(100vw - ${BRAND_FLOAT_MAIN_LEFT_X}px - ${reserveRight}px)`,
    height: 'calc(100vh - 64px)',
    zIndex: Z.main + stackIndex,
  }
}

export function slotStyle(
  slot: ModuleSlot,
  stackIndex: number,
  opts?: MainSlotStyleOptions,
): CSSProperties {
  const hasOverlayRight = opts?.hasOverlayRight ?? false

  if (slot === 'main') {
    return mainSlotStyle(stackIndex, { hasOverlayRight })
  }

  const base: CSSProperties = {
    position: 'fixed',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
  }

  switch (slot) {
    case 'side-top':
      return {
        ...base,
        top: 32,
        right: 32,
        width: SIDE_COLUMN_WIDTH_PX,
        height: 'min(42vh, 420px)',
        zIndex: Z.side + stackIndex,
      }
    case 'side-bottom':
      return {
        ...base,
        top: 'calc(32px + min(42vh, 420px) + 16px)',
        right: 32,
        width: SIDE_COLUMN_WIDTH_PX,
        height: 'calc(100vh - min(42vh, 420px) - 80px)',
        zIndex: Z.side + stackIndex,
      }
    case 'overlay-center':
      return {
        ...base,
        top: '50%',
        left: '50%',
        width: 720,
        maxWidth: 'calc(100vw - 48px)',
        height: 600,
        maxHeight: 'calc(100vh - 48px)',
        transform: 'translate(-50%, -50%)',
        zIndex: Z.overlay + stackIndex,
      }
    case 'overlay-right':
      return {
        ...base,
        top: 32,
        right: 32,
        width: OVERLAY_RIGHT_WIDTH_PX,
        maxWidth: `min(${OVERLAY_RIGHT_WIDTH_PX}px, calc(100vw - ${BRAND_FLOAT_MAIN_LEFT_X}px - 48px))`,
        height: 'calc(100vh - 64px)',
        zIndex: Z.overlay + stackIndex,
      }
    default:
      return { ...base, zIndex: Z.main }
  }
}
