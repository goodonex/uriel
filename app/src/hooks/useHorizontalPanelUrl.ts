import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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

  const onIndexChange = useCallback(
    (idx: number) => {
      setActiveIndex(idx)
      const next = pathForPanel(slug, idx)
      if (pathname !== next) navigate(next, { replace: true })
    },
    [slug, pathname, navigate, pathForPanel],
  )

  return { activeIndex, onIndexChange }
}
