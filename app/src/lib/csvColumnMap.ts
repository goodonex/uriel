/** Heuristik + Inhaltsanalyse für CSV-Spalten (Listen-Import) */

export type ContactListCsvMapKey =
  | 'name'
  | 'vorname'
  | 'nachname'
  | 'email'
  | 'phone'
  | 'company'
  | 'linkedin'
  | 'ansprechpartner'
  | 'standort'
  | 'aufhaenger_angriffsflaeche'
  | 'outcome'
  | 'prio'
  | 'im_crm'
  | 'g_ads'
  | 'keyword'
  | 'website'
  | 'skip'

const UNIQUE_TARGETS: ContactListCsvMapKey[] = [
  'company',
  'phone',
  'ansprechpartner',
  'email',
  'website',
  'linkedin',
  'im_crm',
  'standort',
  'aufhaenger_angriffsflaeche',
  'outcome',
  'prio',
  'g_ads',
  'keyword',
  'name',
  'vorname',
  'nachname',
]

const TARGET_THRESHOLDS: Partial<Record<ContactListCsvMapKey, number>> = {
  company: 0.28,
  phone: 0.38,
  ansprechpartner: 0.32,
  email: 0.45,
  website: 0.4,
  im_crm: 0.55,
  standort: 0.25,
  aufhaenger_angriffsflaeche: 0.32,
  outcome: 0.2,
  prio: 0.2,
  g_ads: 0.2,
  keyword: 0.2,
  name: 0.25,
  vorname: 0.35,
  nachname: 0.35,
}

type ColumnProfile = {
  phone: number
  boolean: number
  company: number
  person: number
  email: number
  url: number
  longText: number
  shortLabel: number
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isPhoneColumnHeader(h: string): boolean {
  if (h.includes('telefon') || h.includes('handy') || h.includes('mobil') || h.includes('fax')) {
    return true
  }
  if (h === 'phone' || h === 'tel' || h === 'nr' || h === 'nummer') return true
  if (/\b(tel|phone|fax)\b/.test(h)) return true
  if (h.endsWith('-tel') || h.startsWith('tel-') || h.endsWith('_tel') || h.startsWith('tel_')) {
    return true
  }
  return false
}

export function guessContactListColumn(header: string): ContactListCsvMapKey {
  const h = normalizeHeader(header)
  if (!h) return 'skip'

  if (h.includes('linkedin')) return 'linkedin'
  if (h.includes('e-mail') || h === 'email' || h === 'mail' || h.includes('email')) return 'email'
  if (isPhoneColumnHeader(h)) return 'phone'
  if (h.includes('website') || h === 'url' || h.includes('webseite') || h.includes('domain')) {
    return 'website'
  }
  if (
    h.includes('firma') ||
    h.includes('unternehmen') ||
    h === 'company' ||
    h.includes('firmenname') ||
    h.includes('organisation')
  ) {
    return 'company'
  }
  if (h.includes('ansprech') || h.includes('kontaktperson')) return 'ansprechpartner'
  if (h.includes('vorname') || h === 'firstname' || h === 'first name') return 'vorname'
  if (h.includes('nachname') || h === 'lastname' || h === 'last name') return 'nachname'
  if (h.includes('standort') || h === 'ort' || h.includes('stadt') || h.includes('city') || h.includes('plz')) {
    return 'standort'
  }
  if (
    h.includes('aufh') ||
    h.includes('angriffs') ||
    h.includes('pain') ||
    h.includes('hook') ||
    h.includes('notiz')
  ) {
    return 'aufhaenger_angriffsflaeche'
  }
  if (h.includes('outcome')) return 'outcome'
  if (h.includes('prio') || h.includes('prior')) return 'prio'
  if (h.includes('im crm') || h === 'crm') return 'im_crm'
  if (h.includes('g ads') || h.includes('google ads') || h.includes('gads')) return 'g_ads'
  if (h.includes('keyword')) return 'keyword'
  if (h === 'name' || h.includes('vollstaendiger name') || h.includes('full name')) return 'name'
  return 'skip'
}

export function looksLikePhoneValue(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^(true|false|ja|nein|yes|no)$/i.test(v)) return false
  const digits = v.replace(/\D/g, '')
  if (digits.length >= 8 && digits.length <= 16) return true
  if (/^(\+|00|0)[\d\s\-/().t]{6,}/i.test(v)) return true
  return false
}

function looksLikeBooleanValue(value: string): boolean {
  return /^(true|false|wahr|falsch|ja|nein|yes|no|1|0)$/i.test(value.trim())
}

function looksLikeCompanyValue(value: string): boolean {
  const v = value.trim()
  if (!v || looksLikeBooleanValue(v) || looksLikePhoneValue(v)) return false
  if (/(gmbh|ug|ag|ohg|kg|mbh|e\.k\.|immobilien| & | und co)/i.test(v)) return true
  return v.length >= 3 && v.length <= 120 && !looksLikePersonNameValue(v)
}

function looksLikePersonNameValue(value: string): boolean {
  const v = value.trim()
  if (!v || looksLikePhoneValue(v) || looksLikeBooleanValue(v)) return false
  if (v.length > 50) return false
  return /^[A-ZÄÖÜ][\wäöüß.'-]+(\s+[A-ZÄÖÜ][\wäöüß.'-]+)+$/.test(v)
}

function looksLikeEmailValue(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function looksLikeUrlValue(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v.startsWith('http') || v.startsWith('www.') || (v.includes('.') && !v.includes(' '))
}

function profileColumn(cells: string[]): ColumnProfile {
  const sample = cells.filter((c) => c.trim().length > 0)
  if (sample.length === 0) {
    return { phone: 0, boolean: 0, company: 0, person: 0, email: 0, url: 0, longText: 0, shortLabel: 0 }
  }
  const n = sample.length
  let phone = 0
  let boolean = 0
  let company = 0
  let person = 0
  let email = 0
  let url = 0
  let longText = 0
  let shortLabel = 0

  for (const c of sample) {
    if (looksLikePhoneValue(c)) phone++
    else if (looksLikeBooleanValue(c)) boolean++
    else if (looksLikeEmailValue(c)) email++
    else if (looksLikeUrlValue(c)) url++
    else if (looksLikeCompanyValue(c)) company++
    else if (looksLikePersonNameValue(c)) person++
    else if (c.length >= 42) longText++
    else if (c.length <= 28) shortLabel++
  }

  return {
    phone: phone / n,
    boolean: boolean / n,
    company: company / n,
    person: person / n,
    email: email / n,
    url: url / n,
    longText: longText / n,
    shortLabel: shortLabel / n,
  }
}

function scoreForTarget(target: ContactListCsvMapKey, p: ColumnProfile): number {
  switch (target) {
    case 'phone':
      return p.phone
    case 'im_crm':
      return p.boolean
    case 'company':
      return p.company
    case 'ansprechpartner':
    case 'name':
    case 'vorname':
    case 'nachname':
      return p.person
    case 'email':
      return p.email
    case 'website':
    case 'linkedin':
      return p.url
    case 'aufhaenger_angriffsflaeche':
    case 'outcome':
      return p.longText
    case 'standort':
      return p.shortLabel * 0.35 + p.longText * 0.15
    default:
      return p.shortLabel * 0.2
  }
}

/**
 * Ordnet jede CSV-Spalte genau einem Zielfeld zu — anhand von Header + Zellinhalt.
 * Verhindert, dass z. B. „FALSE“ oder Ansprechpartner in die Telefon-Spalte rutschen.
 */
export function inferColumnMapping(headers: string[], rows: string[][]): ContactListCsvMapKey[] {
  const sampleRows = rows.slice(0, Math.min(50, rows.length))
  const colCount = headers.length
  const mapping: ContactListCsvMapKey[] = Array(colCount).fill('skip')
  const used = new Set<ContactListCsvMapKey>()

  const columns = headers.map((header, idx) => {
    const cells = sampleRows.map((r) => (r[idx] ?? '').trim())
    const profile = profileColumn(cells)
    const headerGuess = guessContactListColumn(header)
    return { idx, header, profile, headerGuess }
  })

  const tryAssign = (target: ContactListCsvMapKey) => {
    if (used.has(target)) return
    const threshold = TARGET_THRESHOLDS[target] ?? 0.3
    let bestIdx = -1
    let bestScore = threshold

    for (const col of columns) {
      if (mapping[col.idx] !== 'skip') continue
      let score = scoreForTarget(target, col.profile)
      if (col.headerGuess === target) score += 0.22
      if (target === 'phone' && isPhoneColumnHeader(normalizeHeader(col.header))) score += 0.25
      if (target === 'company' && col.headerGuess === 'company') score += 0.2
      if (score > bestScore) {
        bestScore = score
        bestIdx = col.idx
      }
    }

    if (bestIdx >= 0) {
      mapping[bestIdx] = target
      used.add(target)
    }
  }

  for (const target of UNIQUE_TARGETS) {
    tryAssign(target)
  }

  for (const col of columns) {
    if (mapping[col.idx] !== 'skip') continue
    const g = col.headerGuess
    if (g === 'skip' || used.has(g)) continue
    mapping[col.idx] = g
    used.add(g)
  }

  return mapping
}

export type CsvListImportRow = {
  name: string
  email: string
  phone: string
  company: string
  linkedin_url: string
  ansprechpartner: string
  standort: string
  aufhaenger_angriffsflaeche: string
  outcome: string
  prio: string
  im_crm: boolean | null
  g_ads: string
  keyword: string
  website: string
}

function setField(
  o: Record<string, string> & { im_crm?: boolean | null },
  key: ContactListCsvMapKey,
  cell: string,
): void {
  if (key === 'skip') return

  if (key === 'linkedin') {
    if (!o.linkedin_url) o.linkedin_url = cell
    return
  }
  if (key === 'im_crm') {
    const b = parseBooleanCell(cell)
    if (b != null && o.im_crm == null) o.im_crm = b
    return
  }
  if (key === 'phone') {
    if (!o.phone && looksLikePhoneValue(cell)) o.phone = cell
    return
  }
  if (key === 'company') {
    if (!o.company && looksLikeCompanyValue(cell)) o.company = cell
    return
  }
  if (key === 'ansprechpartner' || key === 'name') {
    if (!looksLikePersonNameValue(cell)) return
    if (!o[key]) o[key] = cell
    return
  }
  if (key === 'email') {
    if (!o.email && looksLikeEmailValue(cell)) o.email = cell
    return
  }
  if (key === 'website') {
    if (!o.website && looksLikeUrlValue(cell)) o.website = cell
    return
  }
  if (!o[key]) o[key] = cell
}

/** Zeile importieren — Mapping strikt nach Spaltenindex. */
export function mapCsvRowToListImport(
  row: string[],
  columnMapping: ContactListCsvMapKey[],
): CsvListImportRow {
  const o: Record<string, string> & { im_crm?: boolean | null } = {}

  columnMapping.forEach((key, idx) => {
    const cell = (row[idx] ?? '').trim()
    if (!cell) return
    setField(o, key, cell)
  })

  const displayName = buildDisplayNameFromCsvParts({
    name: o.name,
    vorname: o.vorname,
    nachname: o.nachname,
    ansprechpartner: o.ansprechpartner,
  })

  const apFromParts = [o.vorname, o.nachname].filter((s) => (s ?? '').trim()).join(' ').trim()
  const company = (o.company ?? '').trim()

  return {
    name: displayName || company || 'Lead',
    email: o.email ?? '',
    phone: o.phone ?? '',
    company,
    linkedin_url: o.linkedin_url ?? '',
    ansprechpartner: (o.ansprechpartner ?? '').trim() || apFromParts,
    standort: o.standort ?? '',
    aufhaenger_angriffsflaeche: o.aufhaenger_angriffsflaeche ?? '',
    outcome: o.outcome ?? '',
    prio: o.prio ?? '',
    im_crm: o.im_crm ?? null,
    g_ads: o.g_ads ?? '',
    keyword: o.keyword ?? '',
    website: o.website ?? '',
  }
}

function parseBooleanCell(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (['1', 'true', 'yes', 'y', 'ja', 'j', 'wahr'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'nein', 'falsch'].includes(normalized)) return false
  return null
}

export function buildDisplayNameFromCsvParts(parts: {
  name?: string
  vorname?: string
  nachname?: string
  ansprechpartner?: string
}): string {
  const fromParts = [parts.vorname, parts.nachname].filter((s) => (s ?? '').trim()).join(' ').trim()
  const direct = (parts.name ?? '').trim()
  const ap = (parts.ansprechpartner ?? '').trim()
  return direct || fromParts || ap
}
