/**
 * Kommt Kevin an die Dateien, die das Cockpit ihm zeigen will? (09.09.2026)
 *
 * **Warum es dieses Skript gibt.** Alle anderen Prüfskripte lesen Quelltext
 * oder rechnen mit Fixtures. Der Fehler, der es ausgelöst hat, war in keinem
 * davon sichtbar: Runner, Spiegel, Storage und Oberfläche waren einzeln
 * fehlerfrei — nur die Leseerlaubnis auf `storage.objects` fehlte. Das Cockpit
 * kann „keine Erlaubnis" nicht von „gibt es nicht" unterscheiden und zeigt in
 * beiden Fällen seinen Ersatztext. Es beschuldigte damit Runner und Jophiel,
 * die tadellos liefen.
 *
 * **Wie geprüft wird.** Mit einer echten Sitzung auf Kevins Konto, nicht mit
 * dem service_role-Key — der umgeht RLS und hätte den Fehler nie gezeigt. Das
 * Anmelde-Token wird über die Admin-API erzeugt und verschickt keine E-Mail.
 *
 * Nur lesend: Es signiert URLs und ruft keine ab, legt nichts an, löscht nichts.
 *
 * Start: npx tsx scripts/verify-runner-files-zugriff.ts
 * Braucht `runner/.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) und den
 * anon-Key aus `app/.env.local`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0

function check(was: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ok   ${was}`)
  } else {
    fail++
    console.log(`  FEHL ${was}${detail ? ' — ' + detail : ''}`)
  }
}

/** Ein `KEY=wert` aus einer .env-artigen Datei. Leer, wenn es sie nicht gibt. */
function ausEnv(pfad: string, schluessel: string): string {
  try {
    for (const zeile of readFileSync(join(wurzel, pfad), 'utf8').split('\n')) {
      const t = zeile.trim()
      if (t.startsWith(`${schluessel}=`)) return t.slice(schluessel.length + 1).trim()
    }
  } catch {
    /* Datei fehlt — der Aufrufer entscheidet, ob das ein Abbruch ist. */
  }
  return ''
}

const URL_ = ausEnv('runner/.env', 'SUPABASE_URL')
const SERVICE = ausEnv('runner/.env', 'SUPABASE_SERVICE_ROLE_KEY')
const ANON = ausEnv('app/.env.local', 'VITE_SUPABASE_ANON_KEY') || ausEnv('app/.env', 'VITE_SUPABASE_ANON_KEY')
const KONTO = process.env.URIEL_KONTO ?? 'kevin.herrmann94@gmail.com'

if (!URL_ || !SERVICE || !ANON) {
  console.error('Zugangsdaten fehlen — runner/.env und app/.env.local nötig.')
  process.exit(2)
}

async function ruf(pfad: string, body: unknown, key: string, bearer?: string) {
  const res = await fetch(`${URL_}${pfad}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { apikey: key, Authorization: `Bearer ${bearer ?? key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  try {
    return { status: res.status, daten: JSON.parse(text) as unknown }
  } catch {
    return { status: res.status, daten: text as unknown }
  }
}

console.log('\n1 — Eine Sitzung auf Kevins Konto (ohne E-Mail-Versand)')
const link = await ruf('/auth/v1/admin/generate_link', { type: 'magiclink', email: KONTO }, SERVICE)
const hash =
  (link.daten as { hashed_token?: string; properties?: { hashed_token?: string } })?.hashed_token ??
  (link.daten as { properties?: { hashed_token?: string } })?.properties?.hashed_token
check('Anmelde-Token erzeugt', Boolean(hash), `HTTP ${link.status}`)
if (!hash) {
  console.log(`\nverify-runner-files-zugriff: ${pass} ok, ${fail} fehlgeschlagen`)
  process.exit(1)
}
const sitzung = await ruf('/auth/v1/verify', { type: 'magiclink', token_hash: hash }, ANON)
const token = (sitzung.daten as { access_token?: string })?.access_token
check('Sitzung steht', Boolean(token), `HTTP ${sitzung.status}`)
if (!token) {
  console.log(`\nverify-runner-files-zugriff: ${pass} ok, ${fail} fehlgeschlagen`)
  process.exit(1)
}

console.log('\n2 — Die Bedingung der Policy: eine eigene Brand')
const brands = await ruf('/rest/v1/brands?select=id&limit=5', undefined, ANON, token)
const brandZahl = Array.isArray(brands.daten) ? brands.daten.length : 0
check('Kevin sieht seine brands-Zeilen', brandZahl > 0, `${brandZahl} Zeilen — ohne sie greift die Policy nie`)

console.log('\n3 — Der Bucket, gelesen wie im Browser')
const alsKevin = await ruf('/storage/v1/object/list/runner-files', { prefix: '', limit: 20 }, ANON, token)
const alsRunner = await ruf('/storage/v1/object/list/runner-files', { prefix: '', limit: 20 }, SERVICE)
const kevinZahl = Array.isArray(alsKevin.daten) ? alsKevin.daten.length : -1
const runnerZahl = Array.isArray(alsRunner.daten) ? alsRunner.daten.length : -1
console.log(`       Kevin sieht ${kevinZahl} · service_role sieht ${runnerZahl}`)
check(
  'Kevin sieht im Bucket dasselbe wie der Runner',
  kevinZahl >= runnerZahl && runnerZahl >= 0,
  'sieht der Runner mehr, fehlt die SELECT-Policy auf storage.objects',
)

console.log('\n4 — Genau die Bilder, die das Sales-Canvas anzeigen will')
const snap = await ruf(
  '/rest/v1/runner_snapshots?key=eq.jophiel_projekte&select=data',
  undefined,
  SERVICE,
)
const projekte =
  (Array.isArray(snap.daten) ? (snap.daten[0] as { data?: { projekte?: { shotKey?: string }[] } })?.data?.projekte : []) ??
  []
const keys = projekte.map((p) => p.shotKey).filter((k): k is string => Boolean(k))
check('der Spiegel trägt Vorschau-Schlüssel', keys.length > 0, `${keys.length} Stück`)

if (keys.length) {
  const sig = await ruf('/storage/v1/object/sign/runner-files', { expiresIn: 3600, paths: keys }, ANON, token)
  const zeilen = Array.isArray(sig.daten) ? (sig.daten as { signedURL?: string; error?: string }[]) : []
  const gelungen = zeilen.filter((z) => z.signedURL).length
  console.log(`       signiert: ${gelungen} von ${keys.length}`)
  check(
    'jedes Vorschaubild lässt sich signieren',
    gelungen === keys.length,
    zeilen.find((z) => !z.signedURL)?.error ?? `HTTP ${sig.status}`,
  )
}

console.log('\n5 — Der übrige Datei-Spiegel (Skripte, PDFs, Creatives)')
const idx = await ruf('/rest/v1/runner_snapshots?key=eq.files_index&select=data', undefined, SERVICE)
const gesammelt: string[] = []
const sammle = (x: unknown): void => {
  if (Array.isArray(x)) x.forEach(sammle)
  else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (['key', 'pfad', 'path', 'rel'].includes(k) && typeof v === 'string' && v.includes('/')) gesammelt.push(v)
      else sammle(v)
    }
  }
}
sammle(Array.isArray(idx.daten) ? (idx.daten[0] as { data?: unknown })?.data : null)
const proben = [...new Set(gesammelt)].slice(0, 3)
if (proben.length) {
  const sig2 = await ruf('/storage/v1/object/sign/runner-files', { expiresIn: 3600, paths: proben }, ANON, token)
  const zeilen2 = Array.isArray(sig2.daten) ? (sig2.daten as { signedURL?: string; error?: string }[]) : []
  const ok2 = zeilen2.filter((z) => z.signedURL).length
  console.log(`       Stichprobe: ${ok2} von ${proben.length}`)
  check('auch Skripte und PDFs sind erreichbar', ok2 === proben.length, zeilen2.find((z) => !z.signedURL)?.error ?? '')
} else {
  console.log('       (keine Dateien im Spiegel — nichts zu prüfen)')
}

console.log(`\nverify-runner-files-zugriff: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
