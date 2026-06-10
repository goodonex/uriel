import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { rememberSectionPanelPath } from '../lib/horizontalPanels'
import { sectionFromPathname } from '../lib/scrollFlow'

export function useHorizontalPanelUrl(
  slug: string,
  indexFromPath: (pathname: string) => number,
  pathForPanel: (brandSlug: string, index: number) => string,
) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const routeIndex = indexFromPath(pathname)
  const [activeIndex, setActiveIndex] = useState(routeIndex)

  useEffect(() => {
    setActiveIndex(routeIndex)
  }, [routeIndex])

  useEffect(() => {
    const section = sectionFromPathname(pathname)
    if (section === 'promo' || section === 'sales') {
      rememberSectionPanelPath(slug, section, pathname)
    }
  }, [pathname, slug])

  const onIndexChange = useCallback(
    (idx: number) => {
      setActiveIndex(idx)
      const next = pathForPanel(slug, idx)
      const section = sectionFromPathname(next)
      if (section === 'promo' || section === 'sales') {
        rememberSectionPanelPath(slug, section, next)
      }
      if (pathname !== next) navigate(next, { replace: true })
    },
    [slug, pathname, navigate, pathForPanel],
  )

  return { activeIndex, onIndexChange }
}
