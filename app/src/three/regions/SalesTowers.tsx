import { useMemo } from 'react'
import type { Contact } from '../../types/db'
import { latLonToVector3, type RegionDef } from './regionGeometry'

interface SalesTowersProps {
  def: RegionDef
  planetRadius: number
  contacts: Contact[]
}

function stageEmissive(stage: Contact['pipeline_stage']): number {
  switch (stage) {
    case 'deal':
      return 0.7
    case 'proposal':
      return 0.5
    case 'conversation':
      return 0.35
    case 'first_contact':
      return 0.2
    default:
      return 0.12
  }
}

function contactCompleteness(c: Contact): number {
  const fields = [
    c.name,
    c.email,
    c.phone,
    c.company,
    c.website,
    c.linkedin,
    c.instagram,
    c.notes,
  ]
  const filled = fields.filter((f) => (f ?? '').trim().length > 0).length
  return Math.max(0.2, Math.min(1, filled / fields.length))
}

export function SalesTowers({ def, planetRadius, contacts }: SalesTowersProps) {
  const base = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.1),
    [def.lat, def.lon, planetRadius],
  )

  const sample = contacts.slice(0, 60)

  return (
    <group position={[base.x, base.y, base.z]}>
      {sample.map((contact, idx) => {
        const a = (idx / Math.max(1, sample.length)) * Math.PI * 2
        const r = 0.25 + (idx % 7) * 0.065
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        const h = 0.12 + contactCompleteness(contact) * 0.55
        const emissive = stageEmissive(contact.pipeline_stage)
        return (
          <group key={contact.id} position={[x, h / 2, z]}>
            <mesh>
              <boxGeometry args={[0.08, h, 0.08]} />
              <meshStandardMaterial
                color={def.accent}
                emissive={def.accent}
                emissiveIntensity={emissive}
              />
            </mesh>
            {contact.pipeline_stage === 'deal' ? (
              <mesh position={[0, h * 0.75, 0]}>
                <cylinderGeometry args={[0.008, 0.02, 1.8, 10]} />
                <meshStandardMaterial
                  color="#d6f7ff"
                  emissive="#d6f7ff"
                  emissiveIntensity={0.6}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            ) : null}
          </group>
        )
      })}
    </group>
  )
}
