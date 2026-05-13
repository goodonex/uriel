import { AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ModuleContainer } from '../modules/ModuleContainer'
import { getModuleComponent } from '../modules/registry'
import { OVERLAY_SLOTS, slotStyle, type ModuleSlot } from '../modules/slots'
import { overlayStackIndex, useModuleManager } from '../store/moduleManager'

const SLOT_PAINT_ORDER: Record<ModuleSlot, number> = {
  main: 0,
  'side-top': 1,
  'side-bottom': 2,
  'overlay-right': 3,
  'overlay-center': 4,
}

function resolveFrameStyle(
  slot: ModuleSlot,
  stackIndex: number,
  mobile: boolean,
  hasOverlayRight: boolean,
): CSSProperties {
  const base = slotStyle(slot, stackIndex, { hasOverlayRight })
  if (mobile && slot === 'main') {
    return {
      ...base,
      top: 58,
      left: 0,
      right: 0,
      bottom: 88,
      width: 'auto',
      height: 'auto',
      maxWidth: 'none',
      maxHeight: 'none',
      transform: 'none',
    }
  }
  return base
}

export interface ModuleRendererProps {
  slug: string
  mobile: boolean
}

export function ModuleRenderer({ slug, mobile }: ModuleRendererProps) {
  const modules = useModuleManager((s) => s.modules)
  const close = useModuleManager((s) => s.close)
  const focus = useModuleManager((s) => s.focus)
  const navigate = useNavigate()

  const hasOverlayRight = useMemo(
    () => modules.some((m) => m.slot === 'overlay-right'),
    [modules],
  )

  const ordered = useMemo(() => {
    const list = [...modules]
    list.sort((a, b) => {
      const oa = SLOT_PAINT_ORDER[a.slot] ?? 0
      const ob = SLOT_PAINT_ORDER[b.slot] ?? 0
      if (oa !== ob) return oa - ob
      return a.focusedAt - b.focusedAt
    })
    return list
  }, [modules])

  return (
    <AnimatePresence initial={false}>
      {ordered.map((mod) => {
        const Cmp = getModuleComponent(mod.type)
        if (!Cmp) return null
        const stackIdx = OVERLAY_SLOTS.includes(mod.slot)
          ? overlayStackIndex(modules, mod.slot, mod.id)
          : 0
        const frameStyle = resolveFrameStyle(mod.slot, stackIdx, mobile, hasOverlayRight)
        const title = mod.title ?? mod.type

        return (
          <ModuleContainer
            key={mod.id}
            title={title}
            slot={mod.slot}
            frameStyle={frameStyle}
            compact={mobile}
            onFocus={() => focus(mod.id)}
            onClose={() => {
              if (mod.type === 'contact-detail') {
                navigate(`/brand/${slug}/sales`)
                return
              }
              if (mod.type === 'brand-dashboard') {
                navigate('/')
                return
              }
              if (mod.type === 'promo-workspace') {
                navigate(`/brand/${slug}`)
                return
              }
              if (mod.type === 'workspace-outlet') {
                navigate(`/brand/${slug}`)
                return
              }
              close(mod.id)
            }}
          >
            <Cmp data={mod.data} />
          </ModuleContainer>
        )
      })}
    </AnimatePresence>
  )
}
