import { useState } from 'react'
import { RegionLabel } from './RegionLabel'
import { RegionPatch } from './RegionPatch'
import type { RegionDef } from './regionGeometry'

interface ContinentGroupProps {
  def: RegionDef
  slug: string
  planetRadius: number
}

export function ContinentGroup({ def, slug, planetRadius }: ContinentGroupProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <group>
      <RegionPatch
        def={def}
        slug={slug}
        planetRadius={planetRadius}
        onHoverChange={setHovered}
      />
      <RegionLabel
        def={def}
        slug={slug}
        planetRadius={planetRadius}
        hovered={hovered}
      />
    </group>
  )
}
