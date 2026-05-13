import { useMemo } from 'react'
import { useDeliverProjects } from '../hooks/useDeliverProjects'

function stageIntensity(stage: string): number {
  switch (stage) {
    case 'execute':
      return 1
    case 'visual_world':
      return 0.78
    case 'inner_world':
      return 0.55
    case 'discover':
      return 0.32
    case 'onboarding':
      return 0.22
    default:
      return 0.16
  }
}

function projectPoint(index: number, total: number, radius: number): [number, number, number] {
  const t = (index + 1) / Math.max(1, total + 1)
  const y = 1 - 2 * t
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const phi = Math.PI * (3 - Math.sqrt(5)) * index
  return [Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius]
}

export function Moon({ slug }: { slug: string }) {
  const projects = useDeliverProjects(slug)
  const radius = 3.2

  const points = useMemo(
    () =>
      projects.items.map((p, idx) => ({
        project: p,
        point: projectPoint(idx, projects.items.length, radius + 0.06),
      })),
    [projects.items],
  )

  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial
          color="#737782"
          roughness={0.95}
          metalness={0.02}
          emissive="#15171f"
          emissiveIntensity={0.08}
        />
      </mesh>

      {points.map(({ project, point }, idx) => {
        const completed = project.status === 'completed'
        const intensity = completed ? 0 : stageIntensity(project.internal_stage)
        const pulse = project.internal_stage === 'execute'
        return (
          <group key={project.id} position={point}>
            <mesh>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial
                color={completed ? '#3c3f48' : '#d9edf2'}
                emissive={completed ? '#121318' : '#d9edf2'}
                emissiveIntensity={completed ? 0.04 : 0.22 + intensity * 0.5}
                roughness={0.8}
              />
            </mesh>
            {!completed ? (
              <pointLight
                color="#d9edf2"
                intensity={pulse ? 0.6 + Math.sin(Date.now() * 0.006 + idx) * 0.22 : 0.3 + intensity * 0.5}
                distance={4}
                decay={2}
              />
            ) : null}
          </group>
        )
      })}
    </group>
  )
}
