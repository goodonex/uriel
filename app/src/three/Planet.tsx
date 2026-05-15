import { BrandPlanetMesh } from './BrandPlanetMesh'
import { getBrandWorldColor } from './worldLayout'

interface PlanetProps {
  slug: string
  radius?: number
}

export function Planet({ slug, radius = 5 }: PlanetProps) {
  const color = getBrandWorldColor(slug)

  return (
    <BrandPlanetMesh
      slug={slug}
      radius={radius}
      color={color}
      segments={96}
      rotationSpeed={0.035}
    />
  )
}
