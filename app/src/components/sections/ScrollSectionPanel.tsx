import type { ReactNode } from 'react'
import { CardTile } from '../../modules/CardTile'
import type { SectionKey } from '../../lib/scrollFlow'
import { SECTION_SHELL, SECTION_VIEWPORT } from './sectionLayout'

interface ScrollSectionPanelProps {
  section: SectionKey
  children: ReactNode
}

/** Ein voller Modus im Scroll-Flow — eine Kachel, kein zusätzlicher Glas-Wrapper. */
export function ScrollSectionPanel({ section, children }: ScrollSectionPanelProps) {
  return (
    <div data-scroll-section={section} style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <CardTile
          bare
          flyFrom="left"
          delay={0}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          {children}
        </CardTile>
      </div>
    </div>
  )
}
