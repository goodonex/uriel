import { useViewport } from '../../hooks/useViewport'

/** Desktop: Texturen laden (gleiche Schwelle wie Canvas in App.tsx). */
export function useShouldLoadTextures(): boolean {
  const { width } = useViewport()
  return width >= 1024
}
