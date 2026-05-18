/** Normalisiert Website-URLs für Links und iframe-Embeds. */
export function normalizeWebsiteUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

export function instagramEmbedUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    if (/instagram\.com/i.test(t)) {
      const u = new URL(t.startsWith('http') ? t : `https://${t}`)
      const parts = u.pathname.split('/').filter(Boolean)
      if (!parts.length) return null
      if (parts[0] === 'p' || parts[0] === 'reel' || parts[0] === 'tv') {
        return `${u.origin}/${parts[0]}/${parts[1]}/embed`
      }
      return `${u.origin}/${parts[0]}/embed`
    }
    const handle = t.replace(/^@/, '').split(/[/?#]/)[0]
    if (!handle) return null
    return `https://www.instagram.com/${encodeURIComponent(handle)}/embed`
  } catch {
    return null
  }
}

export function linkedInProfileUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/linkedin\.com/i.test(t)) {
    return t.startsWith('http') ? t : `https://${t}`
  }
  return `https://www.linkedin.com/in/${encodeURIComponent(t.replace(/^\/+/, ''))}`
}
