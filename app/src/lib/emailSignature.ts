/** Signatur an Mail-Body anhängen (Plain oder HTML). */

export function appendEmailSignature(body: string, signature: string): string {
  const sig = signature.trim()
  if (!sig) return body
  if (body.includes(sig)) return body

  const looksLikeHtml = /<\w+[^>]*>/.test(body)
  if (looksLikeHtml) {
    const htmlSig = sig
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
    return `${body}<br><br>--<br>${htmlSig}`
  }

  const base = body.trimEnd()
  const sep = base.endsWith('\n') ? '\n' : '\n\n'
  return `${base}${sep}--\n${sig}`
}

export const DEFAULT_EMAIL_SIGNATURES: Record<string, string> = {
  herrmann: `Beste Grüße
Kevin Herrmann
Herrmann & Co.
kontakt@herrmannundco.de`,
}
