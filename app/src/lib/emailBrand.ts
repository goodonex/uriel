/** Anzeigename & Assets für ausgehende Sales-Mails (Resend). */

const SLUG_FROM_NAME: Record<string, string> = {
  herrmann: 'Herrmann & Co.',
}

export function resolveEmailFromName(brandSlug: string | undefined, brandName?: string): string {
  if (brandSlug && SLUG_FROM_NAME[brandSlug]) return SLUG_FROM_NAME[brandSlug]
  const name = (brandName ?? '').trim()
  if (name && !/^framework\s*os$/i.test(name)) return name
  return 'Herrmann & Co.'
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
