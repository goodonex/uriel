import { useMemo } from 'react'
import { useContentPieces } from '../hooks/useContentPieces'
import { useContacts } from '../hooks/useContacts'
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed'
import { useICPs } from '../hooks/useICPs'
import { usePositioning } from '../hooks/usePositioning'
import { useWordBank } from '../hooks/useWordBank'
import { foundationHealth } from '../lib/foundationHealth'
import { useWorldCamera } from '../store/worldCamera'
import { Planet } from './Planet'
import { BuildingPyramid } from './regions/BuildingPyramid'
import { DiscoveryTower } from './regions/DiscoveryTower'
import { IntelligenceHill } from './regions/IntelligenceHill'
import { PromoField } from './regions/PromoField'
import { RegionLabel } from './regions/RegionLabel'
import { RegionPatch } from './regions/RegionPatch'
import { REGION_DEFS, byRegionKey, latLonToVector3 } from './regions/regionGeometry'
import { SalesTowers } from './regions/SalesTowers'

const PLANET_RADIUS = 5

export function PlanetSurface({ slug }: { slug: string }) {
  const activeRegion = useWorldCamera((s) => s.region)
  const contacts = useContacts(slug)
  const feed = useDiscoveryFeed(slug)
  const content = useContentPieces(slug)
  const icps = useICPs(slug)
  const positioning = usePositioning(slug)
  const wordBank = useWordBank(slug)

  const health = useMemo(
    () =>
      foundationHealth({
        icps: icps.items,
        positioning: positioning.item,
        wordBank: wordBank.items,
      }),
    [icps.items, positioning.item, wordBank.items],
  )

  const intelligenceDef = byRegionKey('intelligence')
  const intelligenceAnchor = latLonToVector3(
    intelligenceDef.lat,
    intelligenceDef.lon,
    PLANET_RADIUS + 0.12,
  )

  const sourceAnchors = useMemo(() => {
    const keys: Array<'sales' | 'promo' | 'discovery'> = [
      'sales',
      'promo',
      'discovery',
    ]
    return keys.map((k) => {
      const d = byRegionKey(k)
      const p = latLonToVector3(d.lat, d.lon, PLANET_RADIUS + 0.12)
      return [
        p.x - intelligenceAnchor.x,
        p.y - intelligenceAnchor.y,
        p.z - intelligenceAnchor.z,
      ] as [number, number, number]
    })
  }, [intelligenceAnchor.x, intelligenceAnchor.y, intelligenceAnchor.z])

  const hasIntelligenceData =
    contacts.items.length > 0 || feed.items.length > 0 || content.items.length > 0

  return (
    <group>
      <ambientLight intensity={0.4} />
      <pointLight color="#ffffff" intensity={2.2} distance={45} position={[0, 12, 0]} />

      <Planet slug={slug} radius={PLANET_RADIUS} />

      {REGION_DEFS.map((def) => (
        <RegionPatch key={def.key} def={def} slug={slug} planetRadius={PLANET_RADIUS} />
      ))}

      {REGION_DEFS.map((def) => (
        <RegionLabel key={`label-${def.key}`} def={def} slug={slug} planetRadius={PLANET_RADIUS} />
      ))}

      <BuildingPyramid
        def={byRegionKey('building')}
        planetRadius={PLANET_RADIUS}
        foundationHealth={health}
      />
      <DiscoveryTower
        def={byRegionKey('discovery')}
        planetRadius={PLANET_RADIUS}
        signalCount={feed.items.length}
      />
      <PromoField
        def={byRegionKey('promo')}
        planetRadius={PLANET_RADIUS}
        pieces={content.items}
      />
      <SalesTowers
        def={byRegionKey('sales')}
        planetRadius={PLANET_RADIUS}
        contacts={contacts.items}
      />
      <IntelligenceHill
        def={intelligenceDef}
        planetRadius={PLANET_RADIUS}
        hasData={hasIntelligenceData}
        sourceAnchors={sourceAnchors}
      />

      {activeRegion ? (
        <group name={`active-region-${activeRegion}`} />
      ) : null}
    </group>
  )
}
