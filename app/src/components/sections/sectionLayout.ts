import type { CSSProperties } from 'react'

/** Platz für Dot-Nav + Browser-Rand */
export const SCROLL_FLOW_RIGHT_INSET = 52

/** Kollabierte Sidebar + Dock (siehe BrandWorkspaceSidebar) */
export const SCROLL_SIDEBAR_CLEARANCE = 120

export const SCROLL_SIDE_CARD_WIDTH = 300
export const SCROLL_PIPELINE_WIDTH = `calc(100vw - ${SCROLL_SIDEBAR_CLEARANCE}px - ${SCROLL_SIDE_CARD_WIDTH}px - 48px)`

export const SECTION_SHELL: CSSProperties = {
  height: 'calc(100vh - var(--workspace-tab-offset, 0px))',
  minHeight: 'calc(100vh - var(--workspace-tab-offset, 0px))',
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
  position: 'relative',
  boxSizing: 'border-box',
  padding: 0,
  pointerEvents: 'none',
  overflow: 'visible',
  background: 'transparent',
}

/** Freier Viewport — Cards liegen absolut, Welt bleibt sichtbar */
export const SECTION_VIEWPORT: CSSProperties = {
  position: 'absolute',
  top: 18,
  right: SCROLL_FLOW_RIGHT_INSET + 16,
  bottom: 24,
  left: 20,
  pointerEvents: 'none',
}
