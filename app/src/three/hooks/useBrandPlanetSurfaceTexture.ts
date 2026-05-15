import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { buildSurfaceTexture } from './useConfiguredTexture'
import { useShouldLoadTextures } from './useShouldLoadTextures'
import { PLANET_TEXTURES, PLANET_TEXTURES_V2 } from '../textureRegistry'

/** Versucht `_v2`-Textur, sonst Basis-Pfad — kein Suspense-Crash bei fehlender Datei. */
export function useBrandPlanetSurfaceTexture(slug: string): THREE.Texture | null {
  const canLoad = useShouldLoadTextures()
  const [tex, setTex] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!canLoad) {
      setTex(null)
      return
    }

    const primary = PLANET_TEXTURES_V2[slug] ?? PLANET_TEXTURES[slug]
    const fallback = PLANET_TEXTURES[slug]
    if (!primary && !fallback) {
      setTex(null)
      return
    }

    let disposed = false
    let built: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()

    const tryLoad = (path: string) =>
      new Promise<THREE.Texture | null>((resolve) => {
        loader.load(path, resolve, undefined, () => resolve(null))
      })

    void (async () => {
      let raw = primary ? await tryLoad(primary) : null
      if (!raw && fallback && fallback !== primary) raw = await tryLoad(fallback)
      if (!raw || disposed) return
      built = buildSurfaceTexture(raw)
      if (!disposed) setTex(built)
    })()

    return () => {
      disposed = true
      built?.dispose()
      setTex(null)
    }
  }, [slug, canLoad])

  return tex
}
