/** Basis (Fallback wenn keine _v2-Datei im CDN/static liegt). */
export const PLANET_TEXTURES: Record<string, string> = {
  herrmann: '/textures/planets/herrmann_surface.jpg',
  wertavio: '/textures/planets/wertavio_surface.jpg',
  culturefit: '/textures/planets/culturefit_surface.jpg',
  homeflower: '/textures/planets/homeflower_surface.jpg',
  eversmell: '/textures/planets/eversmell_surface.jpg',
}

/** Aggressivere Displacement-Varianten (_v2) — Fallback auf PLANET_TEXTURES wenn Datei fehlt. */
export const PLANET_TEXTURES_V2: Record<string, string> = {
  herrmann: '/textures/planets/herrmann_surface_v2.jpg',
  wertavio: '/textures/planets/wertavio_surface_v2.jpg',
  culturefit: '/textures/planets/culturefit_surface_v2.jpg',
  homeflower: '/textures/planets/homeflower_surface_v2.jpg',
  eversmell: '/textures/planets/eversmell_surface_v2.jpg',
}

export const MOON_TEXTURE = '/textures/moon/moon_surface.jpg'
export const MOON_TEXTURE_V2 = '/textures/moon/moon_surface_v2.jpg'
export const GLOW_TEXTURE = '/textures/glow/star_glow.png'

/** Bump-Detail je Kontinent (optional laden — Fallback ohne Bump bei Fehler). */
export const CONTINENT_TEXTURES: Record<string, string> = {
  building: '/textures/continents/foundation_surface.jpg',
  promo: '/textures/continents/promo_surface.jpg',
  sales: '/textures/continents/sales_surface.jpg',
  intelligence: '/textures/continents/intelligence_surface.jpg',
}

/** Sync-Check außerhalb von React (z. B. Scripts). In Komponenten `useShouldLoadTextures` nutzen. */
export function shouldLoadTextures(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= 1024
}
