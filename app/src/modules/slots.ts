import type { CSSProperties } from 'react'

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

export function slotStyle(slot: ModuleSlot, stackIndex: number): CSSProperties {
  const base: CSSProperties = {
    position: 'fixed',
    pointerEvents: 'auto',
    boxSizing: 'border-box',
  }

  switch (slot) {
    case 'main':
      return {
        ...base,
        top: 32,
        left: 96,
        width: '60vw',
        height: 'calc(100vh - 64px)',
        zIndex: Z.main + stackIndex,
      }
    case 'side-top':
      return {
        ...base,
        top: 32,
        right: 32,
        width: 320,
        height: 280,
        zIndex: Z.side + stackIndex,
      }
    case 'side-bottom':
      return {
        ...base,
        top: 332,
        right: 32,
        width: 320,
        height: 'calc(100vh - 364px)',
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
        width: 480,
        maxWidth: 'calc(100vw - 120px)',
        height: 'calc(100vh - 64px)',
        zIndex: Z.overlay + stackIndex,
      }
    default:
      return { ...base, zIndex: Z.main }
  }
}
