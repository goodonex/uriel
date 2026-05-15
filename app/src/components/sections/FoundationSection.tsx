import { BuildingMode } from '../../pages/building/BuildingMode'
import { ScrollSectionPanel } from './ScrollSectionPanel'

export function FoundationSection() {
  return (
    <ScrollSectionPanel section="foundation">
      <BuildingMode layout="scroll" />
    </ScrollSectionPanel>
  )
}
