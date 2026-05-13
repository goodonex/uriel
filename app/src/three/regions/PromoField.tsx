import { useMemo } from 'react'
import { latLonToVector3, type RegionDef } from './regionGeometry'
import type { ContentPiece } from '../../types/db'

interface PromoFieldProps {
  def: RegionDef
  planetRadius: number
  pieces: ContentPiece[]
}

function pieceState(piece: ContentPiece): 'draft' | 'scheduled' | 'live' {
  if (piece.published_at) return 'live'
  if (piece.scheduled_at) return 'scheduled'
  return 'draft'
}

function emissiveForState(state: 'draft' | 'scheduled' | 'live'): number {
  if (state === 'live') return 0.65
  if (state === 'scheduled') return 0.35
  return 0.18
}

export function PromoField({ def, planetRadius, pieces }: PromoFieldProps) {
  const base = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.1),
    [def.lat, def.lon, planetRadius],
  )

  const sample = pieces.slice(0, 70)

  return (
    <group position={[base.x, base.y, base.z]}>
      {sample.map((piece, idx) => {
        const col = idx % 9
        const row = Math.floor(idx / 9)
        const x = (col - 4) * 0.13
        const z = (row - 3) * 0.13
        const state = pieceState(piece)
        return (
          <mesh key={piece.id} position={[x, 0.03, z]}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshStandardMaterial
              color={def.accent}
              emissive={def.accent}
              emissiveIntensity={emissiveForState(state)}
            />
          </mesh>
        )
      })}
    </group>
  )
}
