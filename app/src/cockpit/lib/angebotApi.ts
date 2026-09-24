import { supabase } from '../../lib/supabase'
import type { Angebot } from '../../types/db'

/**
 * Die Leitung zum Angebot (20.09.2026, Blaupause
 * `docs/wargames/angebot-unterschrift.md`).
 *
 * **Zwei Wege, mit Absicht.** Aus dem Cockpit läuft alles über den normalen
 * Client und RLS — Kevin ist angemeldet, und die Regel „nur meine Brand" steht
 * in der Datenbank. Von aussen, wo niemand angemeldet ist, läuft es über die
 * Edge Function `angebot`: Sie gibt genau die Zeile zum Token heraus und sonst
 * nichts. Die Tabelle bekommt **keine** `anon`-Policy — sonst wäre der
 * Unterschied zwischen „dieses Angebot ist über seinen Link erreichbar" und
 * „alle Angebote sind erreichbar" nur noch eine Frage der richtigen Abfrage.
 */

export interface AngebotEntwurf {
  brand_id: string
  contact_id: string
  lead_id?: string | null
  paket: string
  titel: string
  beschreibung?: string
  betrag: number
  retainer_paket?: string | null
  retainer_betrag?: number | null
  /** Tage ab heute. Ohne Angabe 14 — der Wert aus der Migration. */
  gueltig_tage?: number
  notiz?: string
}

function client() {
  if (!supabase) throw new Error('Keine Verbindung zur Datenbank.')
  return supabase
}

/** Die Adresse, die der Makler bekommt. */
export function angebotUrl(token: string): string {
  return `${window.location.origin}/angebot/${token}`
}

export async function ladeAngebote(contactId: string): Promise<Angebot[]> {
  const { data, error } = await client()
    .from('angebote')
    .select('*')
    .eq('contact_id', contactId)
    .order('erstellt_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Angebot[]
}

/**
 * Anlegen. Titel, Beschreibung und Betrag kommen als Werte herein und werden
 * eingefroren — der Paket-Schlüssel allein würde in einem Jahr den Preis von
 * dann bedeuten, nicht den von heute.
 */
export async function erstelleAngebot(entwurf: AngebotEntwurf): Promise<Angebot> {
  const gueltigBis = new Date()
  gueltigBis.setDate(gueltigBis.getDate() + (entwurf.gueltig_tage ?? 14))

  const { data, error } = await client()
    .from('angebote')
    .insert({
      brand_id: entwurf.brand_id,
      contact_id: entwurf.contact_id,
      lead_id: entwurf.lead_id ?? null,
      paket: entwurf.paket,
      titel: entwurf.titel,
      beschreibung: entwurf.beschreibung ?? '',
      betrag: entwurf.betrag,
      retainer_paket: entwurf.retainer_paket ?? null,
      retainer_betrag: entwurf.retainer_betrag ?? null,
      gueltig_bis: gueltigBis.toISOString().slice(0, 10),
      notiz: entwurf.notiz ?? '',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Angebot
}

/**
 * „Ist raus." — der Schritt, der das Angebot signierbar macht.
 *
 * Warum ein eigener Knopf und nicht automatisch beim Anlegen: Ein Entwurf, den
 * Kevin noch anschaut, darf nicht unterschreibbar sein. Die Edge Function
 * signiert ausschliesslich aus `versendet` heraus — dieser Klick ist die
 * Freigabe dafür.
 */
export async function markiereVersendet(id: string): Promise<Angebot> {
  const { data, error } = await client()
    .from('angebote')
    .update({ status: 'versendet', versendet_am: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'entwurf')
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Angebot
}

export async function markiereAbgelehnt(id: string, grund: string): Promise<Angebot> {
  const { data, error } = await client()
    .from('angebote')
    .update({ status: 'abgelehnt', notiz: grund })
    .eq('id', id)
    .in('status', ['entwurf', 'versendet'])
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Angebot
}

/* --- Der öffentliche Weg: nur über die Edge Function ------------------- */

/** Was der Makler sehen darf. Kein Token, keine IP, keine internen Notizen. */
export interface OeffentlichesAngebot {
  titel: string
  beschreibung: string
  betrag: number
  retainer_titel: string | null
  retainer_betrag: number | null
  gueltig_bis: string
  status: 'versendet' | 'signiert' | 'abgelehnt' | 'abgelaufen'
  signiert_am: string | null
  signiert_name: string | null
  firma: string
  empfaenger: string
}

export async function ladeOeffentlichesAngebot(token: string): Promise<OeffentlichesAngebot> {
  const { data, error } = await client().functions.invoke<
    { ok: true; angebot: OeffentlichesAngebot } | { ok: false; fehler: string }
  >('angebot', { body: { aktion: 'lesen', token } })
  if (error) throw new Error(error.message)
  if (!data || !data.ok) throw new Error(data && 'fehler' in data ? data.fehler : 'unbekannt')
  return data.angebot
}

export async function signiereAngebot(
  token: string,
  name: string,
): Promise<{ signiert_am: string; signiert_name: string }> {
  const { data, error } = await client().functions.invoke<
    { ok: true; signiert_am: string; signiert_name: string } | { ok: false; fehler: string }
  >('angebot', { body: { aktion: 'signieren', token, name } })
  if (error) throw new Error(error.message)
  if (!data || !data.ok) throw new Error(data && 'fehler' in data ? data.fehler : 'unbekannt')
  return { signiert_am: data.signiert_am, signiert_name: data.signiert_name }
}
