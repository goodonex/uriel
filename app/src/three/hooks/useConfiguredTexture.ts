import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'

/** Graustufen + Kontrast für Bump/Roughness und subtile Albedo-Modulation (map × brand color). */
function buildSurfaceTexture(source: THREE.Texture): THREE.Texture {
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
    const t = Math.max(0, Math.min(1, (lum / 255 - 0.5) * 2.1 + 0.5))
    const v = Math.round(t * 255)
    px[i] = v
    px[i + 1] = v
    px[i + 2] = v
  }
  ctx.putImageData(data, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}

export function useConfiguredTexture(path: string): THREE.Texture {
  const raw = useLoader(THREE.TextureLoader, path)
  return useMemo(() => buildSurfaceTexture(raw), [raw])
}
