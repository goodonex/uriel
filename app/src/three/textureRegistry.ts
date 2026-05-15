export const PLANET_TEXTURES: Record<string, string> = {
  herrmann: '/textures/planets/herrmann_surface.jpg',
  wertavio: '/textures/planets/wertavio_surface.jpg',
  culturefit: '/textures/planets/culturefit_surface.jpg',
  homeflower: '/textures/planets/homeflower_surface.jpg',
  eversmell: '/textures/planets/eversmell_surface.jpg',
}

export const MOON_TEXTURE = '/textures/moon/moon_surface.jpg'
export const GLOW_TEXTURE = '/textures/glow/star_glow.png'

/** Sync-Check außerhalb von React (z. B. Scripts). In Komponenten `useShouldLoadTextures` nutzen. */
export function shouldLoadTextures(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= 1024
}
