/**
 * Bestandsaufnahme Erstnachrichten (07.09.2026) — was liegt WIRKLICH an?
 *
 * Kevins Frage vor jeder Takt-Entscheidung: „Wie viele Erstnachrichten müssen
 * denn überhaupt geschrieben werden?" Der Runner beantwortet sie nur indirekt
 * (`gesamt` im Input-JSON), und die Kachel zeigt den Topf, nicht die Menschen.
 * Dieses Skript rechnet dieselbe Kette wie `erstnachrichten-input.ts` — aber
 * es zeigt JEDE Stufe des Trichters, damit sichtbar ist, wo die Leute bleiben.
 *
 * Bewusst lesend und ohne Agenten: eine Bestandsaufnahme darf nichts kosten
 * außer ein paar Supabase-Abfragen.
 *
 * Start: npx tsx scripts/bestand-erstnachrichten.ts
 */
import { readFileSync } from 'node:fs'
import { ERSTNACHRICHT_STICHTAG, angenommenOhneErstnachricht, nachStichtag } from '../app/src/cockpit/lib/funnelStufen'
import { icpUrteil, istArbeitsVorrat } from '../app/src/cockpit/lib/icp'

async function main() {

  const env = Object.fromEntries(
    readFileSync(new URL('../runner/.env', import.meta.url), 'utf8')
      .split('\n').filter((z) => z.includes('=') && !z.trim().startsWith('#'))
      .map((z) => { const i = z.indexOf('='); return [z.slice(0, i).trim(), z.slice(i + 1).trim()] as [string, string] }),
  )
  const url = (env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const kopf = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  const slug = env.LINKEDIN_BRAND_SLUG ?? 'herrmann'

  async function alle<T>(pfad: string): Promise<T[]> {
    const out: T[] = []
    for (let off = 0; off < 50_000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/${pfad}&limit=1000&offset=${off}`, { headers: kopf })
      if (!res.ok) throw new Error(`${pfad} HTTP ${res.status}`)
      const z = (await res.json()) as T[]
      out.push(...z); if (z.length < 1000) break
    }
    return out
  }

  const bid = (await alle<any>(`brands?slug=eq.${slug}&select=id`))[0].id
  const [netzwerk, threads, erst] = await Promise.all([
    alle<any>(`linkedin_netzwerk?brand_id=eq.${bid}&select=name,profil_key,profile_url,status,headline,angenommen_at&order=profil_key`),
    alle<any>(`linkedin_threads?brand_id=eq.${bid}&select=name,profile_url&order=id`),
    alle<any>(`linkedin_erstnachrichten?brand_id=eq.${bid}&select=name,status,sent_at,gruppe,last_synced_at&order=id`),
  ])

  const nachStatus = (rows: any[], feld = 'status') =>
    rows.reduce((m: Record<string, number>, r) => ((m[r[feld] ?? '—'] = (m[r[feld] ?? '—'] ?? 0) + 1), m), {})

  const wartendRoh = angenommenOhneErstnachricht(netzwerk, threads, erst, new Date())
  const schonImTopf = new Set(erst.map((e: any) => String(e.name).trim().toLowerCase()))
  const wartend = wartendRoh.filter((p: any) => !schonImTopf.has(p.name.trim().toLowerCase()))
  const nachStichtagArr = wartend.filter((p: any) => nachStichtag(p.seit))
  const vorrat = nachStichtagArr.filter((p: any) => istArbeitsVorrat(icpUrteil(p.info ?? '', p.name).urteil))
  const nachIcp = vorrat.reduce((m: Record<string, number>, p: any) => {
    const u = icpUrteil(p.info ?? '', p.name).urteil; m[u] = (m[u] ?? 0) + 1; return m
  }, {})
  const tage = (p: any) => Math.floor((Date.now() - new Date(p.seit).getTime()) / 86400000)
  const alter = vorrat.map(tage).filter((n: number) => Number.isFinite(n)).sort((a: number, b: number) => a - b)

  console.log('NETZWERK gesamt:', netzwerk.length, nachStatus(netzwerk))
  console.log('THREADS (Postfach):', threads.length)
  console.log('TOPF gesamt:', erst.length, nachStatus(erst))
  console.log('')
  console.log('Angenommen ohne Erstnachricht (roh):', wartendRoh.length)
  console.log('  ohne die, die schon eine Topf-Zeile haben:', wartend.length)
  console.log(`  davon nach Stichtag ${ERSTNACHRICHT_STICHTAG}:`, nachStichtagArr.length)
  console.log('  davon im ICP-Arbeitsvorrat  ==> ARBEITSVORRAT:', vorrat.length, nachIcp)
  console.log('')
  console.log('Wartezeit im Vorrat (Tage seit Annahme): median', alter[Math.floor(alter.length / 2)], '· ältester', alter[alter.length - 1], '· jüngster', alter[0])
  // Kein „heute erzeugt" mehr: `last_synced_at` wird bei JEDEM Sync neu gesetzt
  // und zaehlte deshalb 153 statt der tatsaechlich neuen Zeilen. Die Tabelle
  // hat kein Erstellungsdatum — wer das braucht, muss erst eine Spalte dafuer
  // haben, statt eine vorhandene falsch zu lesen.

}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
