import { useSpring } from 'framer-motion'
import { useEffect } from 'react'

/**
 * Numerischer Spring für 3D-Scale/Height.
 * `trigger` sollte sich ändern wenn ein neues Objekt entsteht.
 */
export function useGrowthSpring(trigger: string, target = 1) {
  const value = useSpring(0, {
    stiffness: 90,
    damping: 14,
    mass: 0.8,
  })

  useEffect(() => {
    value.set(0)
    value.set(target)
  }, [target, trigger, value])

  return value
}
