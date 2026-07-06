interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
}

/** Mini-Sparkline als inline-SVG — kein Chart-Paket (REBUILD-PLAN §5.1). */
export function Sparkline({ values, width = 72, height = 20, color = 'var(--ck-accent)' }: SparklineProps) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`)
    .join(' ')

  return (
    <svg width={width} height={height} aria-hidden style={{ display: 'block', opacity: 0.9 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.25} />
    </svg>
  )
}
