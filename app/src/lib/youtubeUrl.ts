const YT_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i

export function extractYoutubeUrlFromText(text: string): string | null {
  const m = text.match(YT_RE)
  if (!m) return null
  return m[0].startsWith('http') ? m[0] : `https://${m[0]}`
}

export function textContainsYoutubeUrl(text: string): boolean {
  return YT_RE.test(text)
}
