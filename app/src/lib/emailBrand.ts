/** Anzeigename & Assets für ausgehende Sales-Mails (Resend). */

const DEFAULT_PUBLIC_APP = 'https://app-ecru-chi-81.vercel.app'

const SLUG_FROM_NAME: Record<string, string> = {
  herrmann: 'Herrmann & Co.',
}

/** Relativer Pfad — Datei liegt unter app/public/email/ */
export const HERRMANN_EMAIL_LOGO_GIF = '/email/herrmann-logo.gif'
export const HERRMANN_EMAIL_LOGO_PNG = '/email/herrmann-logo.png'

const SLUG_EMAIL_LOGO: Record<string, string> = {
  herrmann: HERRMANN_EMAIL_LOGO_GIF,
}

export function resolveEmailFromName(brandSlug: string | undefined, brandName?: string): string {
  if (brandSlug && SLUG_FROM_NAME[brandSlug]) return SLUG_FROM_NAME[brandSlug]
  const name = (brandName ?? '').trim()
  if (name && !/^framework\s*os$/i.test(name)) return name
  return 'Herrmann & Co.'
}

/** Absolute URL für E-Mail-Clients (img src). */
export function resolveEmailLogoUrl(
  brandSlug: string | undefined,
  publicAppUrl = DEFAULT_PUBLIC_APP,
): string | null {
  const path = brandSlug ? SLUG_EMAIL_LOGO[brandSlug] : null
  if (!path) return null
  return `${publicAppUrl.replace(/\/$/, '')}${path}`
}

export const EMAIL_TEMPLATES_DRAWER_PARAM = 'email-templates'

/** Promo → E-Mail & Flows → Vorlagen */
export function emailTemplatesManagePath(brandSlug: string): string {
  return `/brand/${brandSlug}/promo/email-flows?emailTab=vorlagen`
}

/** Sales-Pipeline: Drawer per Query-Param (Legacy) */
export function salesEmailTemplatesDrawerPath(brandSlug: string): string {
  return `/brand/${brandSlug}/sales?drawer=${EMAIL_TEMPLATES_DRAWER_PARAM}`
}
