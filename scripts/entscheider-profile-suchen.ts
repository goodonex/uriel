/**
 * LinkedIn-Profile der offenen GF-Kandidaten nachsuchen (02.10.2026).
 * Der Runner macht das vor jeder Erstnachrichten-Runde selbst; dieses Skript
 * ist für den Nachlauf bei Altbestand und zum Ausprobieren.
 *
 *   npx tsx scripts/entscheider-profile-suchen.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sucheKandidaten } from '../runner/linkedin/gfSuche.mjs'

const wurzel = join(import.meta.dirname, '..')
const env = Object.fromEntries(
  readFileSync(join(wurzel, 'runner/.env'), 'utf8').split('\n').filter((z) => /^[A-Z_]+=/.test(z)).map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1).trim()]),
)
for (const k of ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD']) if (env[k]) process.env[k] = env[k]
const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
const br = await fetch(`${env.SUPABASE_URL}/rest/v1/brands?slug=eq.herrmann&select=id&limit=1`, { headers })
const [brand] = await br.json()
const r = await sucheKandidaten({ supabaseUrl: env.SUPABASE_URL, headers, brandId: brand.id })
console.log(r)
