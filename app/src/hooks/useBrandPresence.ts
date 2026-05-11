import { useCallback, useEffect, useState } from 'react'
import { loadOne, saveOne } from '../lib/storage'

export interface BrandPresence {
  website_url: string
  instagram_url: string
  linkedin_url: string
  tiktok_url: string
  youtube_url: string
  x_url: string
}

const PRESENCE_KEY = 'brand-presence' as const

function emptyPresence(): BrandPresence {
  return {
    website_url: '',
    instagram_url: '',
    linkedin_url: '',
    tiktok_url: '',
    youtube_url: '',
    x_url: '',
  }
}

/** Startwerte pro Slug (ohne DB); überschreibbar über localStorage. */
const SLUG_DEFAULTS: Partial<Record<string, Partial<BrandPresence>>> = {
  herrmann: {
    website_url: 'https://herrmannundco.de',
  },
  wertavio: {
    website_url: 'https://wertavio.netlify.app',
  },
}

export function normalizeWebUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export function hostLabel(url: string): string {
  if (!url.trim()) return ''
  try {
    return new URL(normalizeWebUrl(url)).host
  } catch {
    return url
  }
}

export function useBrandPresence(slug: string | undefined) {
  const [presence, setPresence] = useState<BrandPresence>(() => emptyPresence())

  useEffect(() => {
    if (!slug) {
      setPresence(emptyPresence())
      return
    }
    const stored = loadOne<Partial<BrandPresence>>([slug, PRESENCE_KEY])
    setPresence({
      ...emptyPresence(),
      ...(SLUG_DEFAULTS[slug] ?? {}),
      ...(stored ?? {}),
    })
  }, [slug])

  const updatePresence = useCallback(
    (patch: Partial<BrandPresence>) => {
      if (!slug) return
      setPresence((p) => {
        const n = { ...p, ...patch }
        saveOne([slug, PRESENCE_KEY], n)
        return n
      })
    },
    [slug],
  )

  return { presence, updatePresence }
}
