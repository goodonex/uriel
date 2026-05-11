/**
 * Reaktive Viewport-Information für Responsive-Logic.
 * Hauptzweck: Mobile-Erkennung für Drawer-Sidebar, Single-Column-Layouts und Call-Mode.
 */
import { useEffect, useState } from 'react'

export interface Viewport {
  width: number
  height: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
}

function read(): Viewport {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768, isMobile: false, isTablet: false, isDesktop: true }
  }
  const w = window.innerWidth
  const h = window.innerHeight
  return {
    width: w,
    height: h,
    isMobile: w < 768,
    isTablet: w >= 768 && w < 1100,
    isDesktop: w >= 1100,
  }
}

export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read)
  useEffect(() => {
    let raf: number | null = null
    const onResize = () => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setVp(read()))
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onResize, { passive: true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])
  return vp
}

export function useIsMobile(): boolean {
  return useViewport().isMobile
}
