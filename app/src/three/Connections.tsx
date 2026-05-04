import { Line } from '@react-three/drei'

interface ConnectionsProps {
  positions: [number, number, number][]
}

export function Connections({ positions }: ConnectionsProps) {
  const segments: Array<[[number, number, number], [number, number, number]]> = []
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      segments.push([positions[i], positions[j]])
    }
  }

  return (
    <>
      {segments.map(([a, b], idx) => (
        <Line
          key={idx}
          points={[a, b]}
          color="#ffffff"
          opacity={0.3}
          transparent
          lineWidth={1}
        />
      ))}
    </>
  )
}
