/**
 * Vergibt nur noch der Server Rollen — und kommt jeder weiter an sein Zeug? (25.09.2026)
 *
 * **Warum es dieses Skript gibt.** Migration 0093 nimmt angemeldeten Nutzern
 * das Schreiben der eigenen Rollen-Zeile, das Anlegen von Brands ohne
 * Owner-Rolle und den Blick in `runner-files`/`push_log`. Ob das greift — und
 * ob Kevin und die Portal-Kunden danach noch alles sehen, was sie sollen —
 * lässt sich nur mit echten Sitzungen prüfen, nicht mit service_role (die
 * umgeht RLS).
 *
 * **Wer geprüft wird.** Kevins Konto (Owner) und sein Portal-Testkonto
 * (`+cmstest`, Rolle client). Die Sitzungen entstehen über die Admin-API,
 * es geht keine E-Mail raus.
 *
 * **Nebenwirkungsfrei.** Die Schreibversuche auf `user_roles` setzen die Rolle
 * auf den Wert, den sie schon hat, oder scheitern an der Eindeutigkeit — vor
 * wie nach 0093 ändert sich nichts. Den Versuch, als Kunde eine Brand
 * anzulegen, macht das Skript erst, wenn 0093 angewendet ist; gelänge er
 * trotzdem, wird die Zeile sofort wieder entfernt.
 *
 * Start: npx tsx scripts/verify-rollen-schutz.ts
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
const OWNER = process.env.URIEL_KONTO ?? 'kevin.herrmann94@gmail.com'
const KUNDE = process.env.URIEL_PORTAL_KONTO ?? 'kevin.herrmann94+cmstest@gmail.com'

if (!URL_ || !SERVICE || !ANON) {
  console.error('Zugangsdaten fehlen — runner/.env und app/.env.local nötig.')
  process.exit(2)
}

async function ruf(
  pfad: string,
  opts: { method?: string; body?: unknown; key?: string; bearer?: string; prefer?: string } = {},
) {
  const key = opts.key ?? ANON
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${opts.bearer ?? key}`,
    'Content-Type': 'application/json',
  }
  if (opts.prefer) headers.Prefer = opts.prefer
  const res = await fetch(`${URL_}${pfad}`, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  let daten: unknown = text
  try {
    daten = JSON.parse(text)
  } catch {
    /* kein JSON */
  }
  return { status: res.status, daten }
}

const zeilen = (d: unknown) => (Array.isArray(d) ? d.length : -1)

async function sitzung(email: string): Promise<{ token: string; id: string } | null> {
  const link = await ruf('/auth/v1/admin/generate_link', { body: { type: 'magiclink', email }, key: SERVICE })
  const d = link.daten as { hashed_token?: string; properties?: { hashed_token?: string } }
  const hash = d?.hashed_token ?? d?.properties?.hashed_token
  if (!hash) return null
  const s = await ruf('/auth/v1/verify', { body: { type: 'magiclink', token_hash: hash } })
  const sd = s.daten as { access_token?: string; user?: { id?: string } }
  return sd?.access_token && sd.user?.id ? { token: sd.access_token, id: sd.user.id } : null
}

const service = {
  pushLog: zeilen((await ruf('/rest/v1/push_log?select=datum', { key: SERVICE })).daten),
  runnerFiles: zeilen(
    (await ruf('/storage/v1/object/list/runner-files', { body: { prefix: '', limit: 20 }, key: SERVICE })).daten,
  ),
}

// Ist 0093 schon angewendet? Die Prüffunktion gibt es erst ab da.
const probe = await ruf('/rest/v1/rpc/is_workspace_owner', { body: {}, key: SERVICE })
const nach0093 = probe.status === 200
console.log(`\nStand: Migration 0093 ${nach0093 ? 'angewendet' : 'NOCH NICHT angewendet'}`)

// ---------------------------------------------------------------------------
console.log(`\n1 — Kevin (${OWNER}) behält alles`)
const k = await sitzung(OWNER)
check('Sitzung steht', Boolean(k))
if (k) {
  const rolle = await ruf(`/rest/v1/user_roles?user_id=eq.${k.id}&select=role`, { bearer: k.token })
  check('eigene Rolle ist owner', (rolle.daten as { role?: string }[])?.[0]?.role === 'owner')
  const brands = await ruf('/rest/v1/brands?select=id', { bearer: k.token })
  check('sieht seine Brands', zeilen(brands.daten) > 0, `${zeilen(brands.daten)} Zeilen`)
  const rf = await ruf('/storage/v1/object/list/runner-files', { body: { prefix: '', limit: 20 }, bearer: k.token })
  check(
    'sieht runner-files wie der Runner',
    zeilen(rf.daten) >= service.runnerFiles && service.runnerFiles > 0,
    `${zeilen(rf.daten)} von ${service.runnerFiles}`,
  )
  const pl = await ruf('/rest/v1/push_log?select=datum', { bearer: k.token })
  check('liest push_log', zeilen(pl.daten) === service.pushLog, `${zeilen(pl.daten)} von ${service.pushLog}`)
  if (nach0093) {
    const own = await ruf('/rest/v1/rpc/is_workspace_owner', { body: {}, bearer: k.token })
    check('is_workspace_owner() = true', own.daten === true, JSON.stringify(own.daten))
  }
  const upd = await ruf(`/rest/v1/user_roles?user_id=eq.${k.id}`, {
    method: 'PATCH',
    body: { role: 'owner' },
    bearer: k.token,
    prefer: 'return=representation',
  })
  check(
    'kann die eigene Rolle nicht selbst schreiben',
    zeilen(upd.daten) <= 0,
    `HTTP ${upd.status}, ${zeilen(upd.daten)} Zeile(n) geändert`,
  )
}

// ---------------------------------------------------------------------------
console.log(`\n2 — Portal-Testkonto (${KUNDE}) behält das Portal, sonst nichts`)
const c = await sitzung(KUNDE)
check('Sitzung steht', Boolean(c))
if (c) {
  const rolle = await ruf(`/rest/v1/user_roles?user_id=eq.${c.id}&select=role,project_id`, { bearer: c.token })
  const r = (rolle.daten as { role?: string; project_id?: string }[])?.[0]
  check('eigene Rolle ist client mit Projekt', r?.role === 'client' && Boolean(r?.project_id))
  if (r?.project_id) {
    const p = await ruf(`/rest/v1/deliver_projects?id=eq.${r.project_id}&select=id`, { bearer: c.token })
    check('sieht sein Portal-Projekt', zeilen(p.daten) === 1, `${zeilen(p.daten)} Zeilen`)
    const b = await ruf('/rest/v1/brands?select=id', { bearer: c.token })
    check('sieht die Brand seines Projekts (fürs Portal)', zeilen(b.daten) >= 1, `${zeilen(b.daten)} Zeilen`)
  }
  const upd = await ruf(`/rest/v1/user_roles?user_id=eq.${c.id}`, {
    method: 'PATCH',
    body: { role: 'client' },
    bearer: c.token,
    prefer: 'return=representation',
  })
  check(
    'kann Rolle/Projekt nicht selbst ändern',
    zeilen(upd.daten) <= 0,
    `HTTP ${upd.status}, ${zeilen(upd.daten)} Zeile(n) änderbar`,
  )
  const ins = await ruf('/rest/v1/user_roles', {
    body: { user_id: c.id, role: 'owner' },
    bearer: c.token,
  })
  const code = (ins.daten as { code?: string })?.code
  check('kann sich keine Rollen-Zeile anlegen', code === '42501', `Antwort ${code ?? ins.status}`)
  const rf = await ruf('/storage/v1/object/list/runner-files', { body: { prefix: '', limit: 20 }, bearer: c.token })
  check('sieht keine runner-files', zeilen(rf.daten) <= 0, `${zeilen(rf.daten)} Objekte`)
  const pl = await ruf('/rest/v1/push_log?select=datum', { bearer: c.token })
  check('sieht kein push_log', zeilen(pl.daten) <= 0, `${zeilen(pl.daten)} Zeilen`)
  if (nach0093) {
    const own = await ruf('/rest/v1/rpc/is_workspace_owner', { body: {}, bearer: c.token })
    check('is_workspace_owner() = false', own.daten === false, JSON.stringify(own.daten))
    const brand = await ruf('/rest/v1/brands', {
      body: { user_id: c.id, name: 'verify-rollen-schutz', slug: `verify-rollen-schutz-${Date.now()}` },
      bearer: c.token,
      prefer: 'return=representation',
    })
    const angelegt = zeilen(brand.daten) > 0
    if (angelegt) {
      await ruf(`/rest/v1/brands?user_id=eq.${c.id}&name=eq.verify-rollen-schutz`, { method: 'DELETE', key: SERVICE })
    }
    check('kann keine Brand anlegen', !angelegt, `HTTP ${brand.status}`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n3 — Ohne Anmeldung')
check('push_log leer', zeilen((await ruf('/rest/v1/push_log?select=datum')).daten) <= 0)
check('user_roles leer', zeilen((await ruf('/rest/v1/user_roles?select=user_id')).daten) <= 0)
// Über die Einstellungen statt per Registrierungsversuch — der würde bei
// offener Registrierung ein Konto anlegen.
const settings = (await ruf('/auth/v1/settings')).daten as { disable_signup?: boolean }
check('Selbst-Registrierung ist zu', settings?.disable_signup === true, JSON.stringify(settings?.disable_signup))

console.log(`\nverify-rollen-schutz: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
