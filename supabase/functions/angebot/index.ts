// angebot — der öffentliche Weg zum Angebot: lesen und unterschreiben.
//
// POST /functions/v1/angebot
//   { aktion: 'lesen',     token }
//   { aktion: 'signieren', token, name }
//
// Blaupause: docs/wargames/angebot-unterschrift.md (20.09.2026).
//
// **Warum eine Function und keine RLS-Policy für `anon`.** Eine Policy gilt für
// die Tabelle, nicht für eine Zeile: Wer sie hätte, könnte jede Abfrage
// stellen, die die Policy erlaubt — und eine Policy, die „nur die Zeile zu
// diesem Token" ausdrückt, gibt es nicht, weil das Token in der Abfrage steht
// und nicht in der Sitzung. Hier gibt es genau zwei Antworten: die eine Zeile,
// oder nichts.
//
// **Warum IP und User-Agent hier entstehen und nicht in der Datenbank.**
// `inet_client_addr()` liefert hinter dem Verbindungs-Pooler die Adresse des
// Poolers, nicht die des Maklers. Die Header sind die einzige Stelle, an der
// die echte Adresse noch steht.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

/**
 * Eine einzige Antwort für „gibt es nicht", „ist noch Entwurf" und „abgelaufen".
 * Wer den Link rät, soll nicht am Unterschied der Fehlermeldungen ablesen
 * können, ob er nah dran war.
 */
const NICHT_DA = { ok: false, fehler: 'nicht_gefunden' }

interface Body {
  aktion?: 'lesen' | 'signieren'
  token?: string
  name?: string
}

function abgelaufen(gueltigBis: string): boolean {
  return gueltigBis < new Date().toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ ok: false, fehler: 'methode' }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, fehler: 'kein_json' }, 400)
  }

  const token = (body.token ?? '').trim()
  // 32 Hex — alles andere ist kein Token dieser Anwendung und wird gar nicht
  // erst zu einer Datenbankabfrage.
  if (!/^[0-9a-f]{32}$/.test(token)) return json(NICHT_DA, 404)

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: angebot } = await db
    .from('angebote')
    .select('id, brand_id, contact_id, lead_id, titel, beschreibung, betrag, retainer_paket, retainer_betrag, status, gueltig_bis, signiert_am, signiert_name')
    .eq('token', token)
    .maybeSingle()

  // Ein Entwurf ist noch nicht raus — für die Aussenwelt gibt es ihn nicht.
  if (!angebot || angebot.status === 'entwurf') return json(NICHT_DA, 404)

  const { data: brand } = await db.from('brands').select('name').eq('id', angebot.brand_id).maybeSingle()
  const { data: kontakt } = await db
    .from('contacts')
    .select('name, company, rechnung_firma')
    .eq('id', angebot.contact_id)
    .maybeSingle()

  const retainerTitel = angebot.retainer_paket === 'retainer-2000'
    ? 'Kampagne + Nachfassen'
    : angebot.retainer_paket === 'retainer-1000'
      ? 'Kampagne'
      : null

  const sichtbar = {
    titel: angebot.titel,
    beschreibung: angebot.beschreibung,
    betrag: Number(angebot.betrag),
    retainer_titel: retainerTitel,
    retainer_betrag: angebot.retainer_betrag == null ? null : Number(angebot.retainer_betrag),
    gueltig_bis: angebot.gueltig_bis,
    status: (abgelaufen(angebot.gueltig_bis) && angebot.status === 'versendet' ? 'abgelaufen' : angebot.status) as
      | 'versendet' | 'signiert' | 'abgelehnt' | 'abgelaufen',
    signiert_am: angebot.signiert_am,
    signiert_name: angebot.signiert_name,
    firma: brand?.name ?? '',
    empfaenger: kontakt?.rechnung_firma || kontakt?.company || kontakt?.name || '',
  }

  if (body.aktion === 'lesen') return json({ ok: true, angebot: sichtbar })
  if (body.aktion !== 'signieren') return json({ ok: false, fehler: 'unbekannte_aktion' }, 400)

  /* --- Signieren ------------------------------------------------------- */

  // Schon unterschrieben: freundlich dasselbe Ergebnis zurückgeben. Ein
  // Doppelklick oder ein Reload ist kein Fehler des Maklers.
  if (angebot.status === 'signiert') {
    return json({ ok: true, signiert_am: angebot.signiert_am, signiert_name: angebot.signiert_name })
  }
  if (angebot.status !== 'versendet') return json({ ok: false, fehler: 'nicht_offen' }, 409)
  if (abgelaufen(angebot.gueltig_bis)) return json({ ok: false, fehler: 'abgelaufen' }, 409)

  const name = (body.name ?? '').trim()
  if (name.length < 3 || name.length > 120) return json({ ok: false, fehler: 'name_fehlt' }, 400)

  const jetzt = new Date().toISOString()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64)
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 300)

  // Die Bedingung `status = 'versendet'` IST die Regel — zwei gleichzeitige
  // Klicks können nicht beide gewinnen, und die Datenbank entscheidet das, nicht
  // eine Prüfung ein paar Zeilen weiter oben.
  const { data: signiert, error: signierFehler } = await db
    .from('angebote')
    .update({ status: 'signiert', signiert_am: jetzt, signiert_name: name, signiert_ip: ip, signiert_ua: ua })
    .eq('id', angebot.id)
    .eq('status', 'versendet')
    .select('signiert_am, signiert_name')
    .maybeSingle()

  if (signierFehler) return json({ ok: false, fehler: 'nicht_gespeichert' }, 500)
  // Kein Treffer heisst: jemand anderes war in derselben Sekunde schneller.
  // Dann ist es unterschrieben, nur nicht von diesem Aufruf.
  if (!signiert) return json({ ok: true, signiert_am: jetzt, signiert_name: name })

  /* --- Was daran hängt --------------------------------------------------
   * Ab hier ist die Unterschrift bereits sicher gespeichert. Scheitert einer
   * der folgenden Schritte, wird die Unterschrift NICHT zurückgedreht — der
   * Angebots-Datensatz ist die Wahrheit, der Rest ist Nachführung. Deshalb
   * werden Fehler hier protokolliert und nicht an den Makler gemeldet: Er hat
   * unterschrieben, und das ist passiert.
   */
  const { error: kontaktFehler } = await db
    .from('contacts')
    .update({ pipeline_stage: 'deal', stage_changed_at: jetzt, won_at: jetzt })
    .eq('id', angebot.contact_id)
  if (kontaktFehler) console.error('[angebot] Kontakt nicht auf deal gesetzt:', kontaktFehler.message)

  if (angebot.lead_id) {
    const { error: leadFehler } = await db
      .from('leads')
      .update({ lead_status: 'kunde', updated_at: jetzt })
      .eq('id', angebot.lead_id)
    if (leadFehler) console.error('[angebot] Lead nicht auf kunde gesetzt:', leadFehler.message)

    const { error: ereignisFehler } = await db.from('lead_ereignisse').insert({
      brand_id: angebot.brand_id,
      lead_id: angebot.lead_id,
      typ: 'angebot_signiert',
      at: jetzt,
      quelle: 'ui',
      details: { angebot_id: angebot.id, betrag: Number(angebot.betrag), name },
    })
    if (ereignisFehler) console.error('[angebot] Ereignis nicht geschrieben:', ereignisFehler.message)
  }

  return json({ ok: true, signiert_am: signiert.signiert_am, signiert_name: signiert.signiert_name })
})
