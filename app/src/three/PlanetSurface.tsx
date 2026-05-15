import { useMemo } from 'react'
import * as THREE from 'three'
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
import { ContinentGroup } from './regions/ContinentGroup'
import { DiscoveryTower } from './regions/DiscoveryTower'
import { IntelligenceHill } from './regions/IntelligenceHill'
import { PromoField } from './regions/PromoField'
import {
  REGION_DEFS,
  SHOW_REGION_BUILDINGS,
  byRegionKey,
  latLonToVector3,
} from './regions/regionGeometry'
import { SalesTowers } from './regions/SalesTowers'
import { PLANET_SURFACE_SCENE_RADIUS, getBrandWorldColor } from './worldLayout'

const PLANET_RADIUS = PLANET_SURFACE_SCENE_RADIUS

export function PlanetSurface({ slug }: { slug: string }) {
  const activeRegion = useWorldCamera((s) => s.region)
  const contacts = useContacts(slug)
  const feed = useDiscoveryFeed(slug)
  const content = useContentPieces(slug)
  const icps = useICPs(slug)
  const positioning = usePositioning(slug)
  const wordBank = useWordBank(slug)

  const brandLight = useMemo(() => getBrandWorldColor(slug), [slug])

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
    const keys: Array<'sales' | 'promo'> = ['sales', 'promo']
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
      <ambientLight intensity={0.32} />
      <pointLight color={brandLight} intensity={3.5} distance={12} decay={2} position={[5, 10, 6]} />
      <pointLight color="#eef2ff" intensity={0.3} distance={45} decay={2} position={[-8, 6, -4]} />

      <Planet slug={slug} radius={PLANET_RADIUS} />

      <mesh renderOrder={-1}>
        <sphereGeometry args={[PLANET_RADIUS + 0.22, 64, 64]} />
        <meshStandardMaterial
          color="#4488ff"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh renderOrder={-2}>
        <sphereGeometry args={[PLANET_RADIUS + 0.45, 56, 56]} />
        <meshStandardMaterial
          color="#88aaff"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {REGION_DEFS.map((def) => (
        <ContinentGroup key={def.key} def={def} slug={slug} planetRadius={PLANET_RADIUS} />
      ))}

      {SHOW_REGION_BUILDINGS ? (
        <>
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
        </>
      ) : null}

      {activeRegion ? <group name={`active-region-${activeRegion}`} /> : null}
    </group>
  )
}
