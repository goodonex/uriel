import { useLoader } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'

function boostContrastForBump(source: THREE.Texture): THREE.Texture {
  const image = source.image as HTMLImageElement | undefined
  if (!image?.width || !image?.height) return source

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return source

  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
    const t = Math.max(0, Math.min(1, (lum / 255 - 0.5) * 1.65 + 0.5))
    const v = Math.round(t * 255)
    px[i] = v
    px[i + 1] = v
    px[i + 2] = v
  }
  ctx.putImageData(data, 0, 0)

  const boosted = new THREE.CanvasTexture(canvas)
  boosted.colorSpace = THREE.SRGBColorSpace
  boosted.wrapS = THREE.RepeatWrapping
  boosted.wrapT = THREE.RepeatWrapping
  boosted.generateMipmaps = true
  boosted.minFilter = THREE.LinearMipmapLinearFilter
  boosted.magFilter = THREE.LinearFilter
  boosted.needsUpdate = true
  return boosted
}

function applySurfaceTextureSettings(texture: THREE.Texture): THREE.Texture {
  const tuned = boostContrastForBump(texture)
  tuned.colorSpace = THREE.SRGBColorSpace
  tuned.wrapS = THREE.RepeatWrapping
  tuned.wrapT = THREE.RepeatWrapping
  tuned.generateMipmaps = true
  tuned.minFilter = THREE.LinearMipmapLinearFilter
  tuned.magFilter = THREE.LinearFilter
  return tuned
}

/** Lädt und konfiguriert eine Surface-Texture — nur in Suspense-Subtree verwenden. */
export function useConfiguredTexture(path: string): THREE.Texture {
  const raw = useLoader(THREE.TextureLoader, path)
  const texture = useMemo(() => applySurfaceTextureSettings(raw), [raw])
  useLayoutEffect(() => {
    texture.needsUpdate = true
  }, [texture])
  return texture
}
