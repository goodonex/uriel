/**
 * Variablen-Replacement für Mail-Templates.
 * Format: {{name}}, {{company}}, {{ansprechpartner}}, {{brand.name}}, {{brand.positioning}}
 */
import type { Contact, Positioning } from '../types/db'

export interface EmailVarContext {
  contact: Contact
  brandName?: string
  positioning?: Positioning | null
}

const PRIMITIVE_KEYS: Array<keyof Contact> = [
  'name',
  'email',
  'phone',
  'website',
  'instagram',
  'linkedin',
  'company',
  'bedarf',
  'ansprechpartner',
  'aktuelle_situation',
  'hauptproblem',
  'timeline',
  'budget',
  'entscheider_name',
  'einwaende',
  'naechste_schritte',
  'potenzial_notiz',
]

function firstName(name: string): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

export function availableVariables(): Array<{ key: string; label: string }> {
  return [
    { key: 'name', label: 'Voller Name' },
    { key: 'first_name', label: 'Vorname' },
    { key: 'email', label: 'E-Mail' },
    { key: 'phone', label: 'Telefon' },
    { key: 'company', label: 'Firma' },
    { key: 'ansprechpartner', label: 'Ansprechpartner' },
    { key: 'bedarf', label: 'Bedarf' },
    { key: 'hauptproblem', label: 'Hauptproblem' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'brand.name', label: 'Brand-Name' },
    { key: 'brand.positioning', label: 'Positioning-Statement' },
  ]
}

export function renderEmailTemplate(template: string, ctx: EmailVarContext): string {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, raw: string) => {
    const key = raw.trim()
    if (key === 'first_name') return firstName(ctx.contact.name ?? '')
    if (key === 'datum') {
      return new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    }
    if (key === 'anrede') {
      const parts = (ctx.contact.name ?? '').trim().split(/\s+/)
      const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? ''
      return last ? `Herr/Frau ${last}` : ''
    }
    if (key === 'brand.name') return ctx.brandName ?? ''
    if (key === 'brand.positioning') return ctx.positioning?.statement ?? ''
    if (PRIMITIVE_KEYS.includes(key as keyof Contact)) {
      const v = ctx.contact[key as keyof Contact]
      return typeof v === 'string' ? v : v == null ? '' : String(v)
    }
    return ''
  })
}

export function buildMailtoUrl(opts: {
  to: string
  subject: string
  body: string
  cc?: string
  bcc?: string
}): string {
  const params = new URLSearchParams()
  if (opts.subject) params.set('subject', opts.subject)
  if (opts.body) params.set('body', opts.body)
  if (opts.cc) params.set('cc', opts.cc)
  if (opts.bcc) params.set('bcc', opts.bcc)
  const qs = params.toString().replace(/\+/g, '%20')
  return `mailto:${encodeURIComponent(opts.to)}${qs ? `?${qs}` : ''}`
}
