/**
 * runner/linkedin/protokoll.mjs — Protokoll der Prüf-Entscheidungen (02.10.2026, Migration 0096).
 *
 * Kevin: „Lass mich diese Prüfsachen am Anfang selbst beantworten. Aber schreib
 * einen Log, dass das protokolliert wird, dass man nach 30 Tagen daraus lernen
 * kann." Jede Entscheidung, die den Weg eines Leads ändert (Agent oder Kevin),
 * wird mit Grund festgehalten. Fehler hier dürfen nie den Lauf stören — das
 * Protokoll ist Beobachtung, keine Voraussetzung.
 */

/**
 * @param {{supabaseUrl: string, headers: Record<string,string>, brandId: string}} ctx
 * @param {{art: string, name: string, firma?: string, von?: 'kevin'|'agent', entscheidung: string, grund?: string, daten?: object}[]} eintraege
 */
export async function protokolliere({ supabaseUrl, headers, brandId }, eintraege) {
  const zeilen = (eintraege ?? [])
    .filter((e) => e?.art && e?.name && e?.entscheidung)
    .map((e) => ({
      brand_id: brandId,
      art: e.art,
      name: String(e.name).slice(0, 200),
      firma: String(e.firma ?? '').slice(0, 200),
      von: e.von === 'kevin' ? 'kevin' : 'agent',
      entscheidung: String(e.entscheidung).slice(0, 60),
      grund: String(e.grund ?? '').slice(0, 500),
      daten: e.daten ?? {},
    }))
  if (!zeilen.length) return 0
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/pruef_protokoll`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(zeilen),
    })
    if (!res.ok) {
      console.error(`[runner] Prüf-Protokoll HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 120)}`)
      return 0
    }
    return zeilen.length
  } catch (e) {
    console.error('[runner] Prüf-Protokoll fehlgeschlagen:', e?.message ?? e)
    return 0
  }
}
