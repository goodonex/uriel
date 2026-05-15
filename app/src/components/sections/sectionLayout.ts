import type { CSSProperties } from 'react'

export const SECTION_SHELL: CSSProperties = {
  height: '100vh',
  minHeight: '100vh',
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
  position: 'relative',
  boxSizing: 'border-box',
  padding: '20px 24px 28px',
  pointerEvents: 'none',
}

export const SECTION_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 34%)',
  gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 14,
  height: 'calc(100vh - 48px)',
  maxHeight: 'calc(100vh - 48px)',
  pointerEvents: 'none',
}

export const SECTION_GRID_SINGLE: CSSProperties = {
  ...SECTION_GRID,
  gridTemplateColumns: 'minmax(0, 1fr)',
}
