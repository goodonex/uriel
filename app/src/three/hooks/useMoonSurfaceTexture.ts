import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { buildSurfaceTexture } from './useConfiguredTexture'
import { useShouldLoadTextures } from './useShouldLoadTextures'
import { MOON_TEXTURE, MOON_TEXTURE_V2 } from '../textureRegistry'

export function useMoonSurfaceTexture(): THREE.Texture | null {
  const canLoad = useShouldLoadTextures()
  const [tex, setTex] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (!canLoad) {
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
      let raw = await tryLoad(MOON_TEXTURE_V2)
      if (!raw) raw = await tryLoad(MOON_TEXTURE)
      if (!raw || disposed) return
      built = buildSurfaceTexture(raw)
      if (!disposed) setTex(built)
    })()

    return () => {
      disposed = true
      built?.dispose()
      setTex(null)
    }
  }, [canLoad])

  return tex
}
