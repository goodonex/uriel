import { useLoader } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import * as THREE from 'three'

function applySurfaceTextureSettings(texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
}

/** Lädt und konfiguriert eine Texture — nur in Suspense-Subtree verwenden. */
export function useConfiguredTexture(path: string): THREE.Texture {
  const texture = useLoader(THREE.TextureLoader, path)
  useLayoutEffect(() => {
    applySurfaceTextureSettings(texture)
  }, [texture])
  return texture
}
