import * as THREE from 'three'

function fract(v: number): number {
  return v - Math.floor(v)
}

function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return fract(n)
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy

  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)

  const ux = smoothstep(fx)
  const uy = smoothstep(fy)
  const x1 = a + (b - a) * ux
  const x2 = c + (d - c) * ux
  return x1 + (x2 - x1) * uy
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise(x * freq, y * freq, seed + i * 17.31) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return norm > 0 ? sum / norm : 0
}

interface PlanetSurfaceTexturesOptions {
  size?: number
  baseColor: string
  seed?: number
  contrast?: number
}

export interface PlanetSurfaceTextures {
  map: THREE.CanvasTexture
  bumpMap: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
}

/**
 * Erzeugt prozedurale Surface-Texturen für Planeten:
 * - `map` (leichte Helligkeitsvariation um die Basisfarbe)
 * - `bumpMap`
 * - `roughnessMap` (roughness-Spanne 0.6..0.9)
 */
export function createPlanetSurfaceTextures({
  size = 256,
  baseColor,
  seed = 1.337,
  contrast = 0.55,
}: PlanetSurfaceTexturesOptions): PlanetSurfaceTextures {
  const albedoCanvas = document.createElement('canvas')
  const bumpCanvas = document.createElement('canvas')
  const roughCanvas = document.createElement('canvas')
  albedoCanvas.width = size
  albedoCanvas.height = size
  bumpCanvas.width = size
  bumpCanvas.height = size
  roughCanvas.width = size
  roughCanvas.height = size

  const albedoCtx = albedoCanvas.getContext('2d')
  const bumpCtx = bumpCanvas.getContext('2d')
  const roughCtx = roughCanvas.getContext('2d')
  if (!albedoCtx || !bumpCtx || !roughCtx) {
    const map = new THREE.CanvasTexture(albedoCanvas)
    const bumpMap = new THREE.CanvasTexture(bumpCanvas)
    const roughnessMap = new THREE.CanvasTexture(roughCanvas)
    return { map, bumpMap, roughnessMap }
  }

  const base = new THREE.Color(baseColor)
  const albedoImage = albedoCtx.createImageData(size, size)
  const bumpImage = bumpCtx.createImageData(size, size)
  const roughImage = roughCtx.createImageData(size, size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const nx = x / size
      const ny = y / size
      const n = fbm(nx * 6.8, ny * 6.8, seed, 5)
      const shaped = Math.min(1, Math.max(0, 0.5 + (n - 0.5) * (1 + contrast)))

      const brightness = 0.86 + shaped * 0.28
      const c = base.clone().multiplyScalar(brightness)
      albedoImage.data[i] = Math.round(c.r * 255)
      albedoImage.data[i + 1] = Math.round(c.g * 255)
      albedoImage.data[i + 2] = Math.round(c.b * 255)
      albedoImage.data[i + 3] = 255

      const bump = Math.round(shaped * 255)
      bumpImage.data[i] = bump
      bumpImage.data[i + 1] = bump
      bumpImage.data[i + 2] = bump
      bumpImage.data[i + 3] = 255

      const rough = 0.6 + shaped * 0.3
      const roughGray = Math.round(rough * 255)
      roughImage.data[i] = roughGray
      roughImage.data[i + 1] = roughGray
      roughImage.data[i + 2] = roughGray
      roughImage.data[i + 3] = 255
    }
  }

  albedoCtx.putImageData(albedoImage, 0, 0)
  bumpCtx.putImageData(bumpImage, 0, 0)
  roughCtx.putImageData(roughImage, 0, 0)

  const map = new THREE.CanvasTexture(albedoCanvas)
  const bumpMap = new THREE.CanvasTexture(bumpCanvas)
  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping
  map.needsUpdate = true
  bumpMap.needsUpdate = true
  roughnessMap.needsUpdate = true

  return { map, bumpMap, roughnessMap }
}
