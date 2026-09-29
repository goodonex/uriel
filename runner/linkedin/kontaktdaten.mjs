/**
 * runner/linkedin/kontaktdaten.mjs — Telefon und E-Mail aus dem Impressum (29.09.2026).
 *
 * **Der Anlass.** Kevin will ab dem 29.09. täglich 50 Leads anrufen. In Uriel
 * stand bei keinem der 2.323 Leads eine Nummer — obwohl die Bewertung (Stufe 1,
 * `grundprofil.mjs`) jedes Impressum längst liest. Die Nummer lag also schon
 * im Text, sie wurde nur nicht herausgezogen.
 *
 * **Handy vor Festnetz.** Kevin: *„Wenn da eine Handynummer drin steht, dann
 * kommt sie wahrscheinlich. Bei einer Festnetznummer wird wahrscheinlich nicht
 * so gut drauf und dran gegangen."* Deshalb getrennt: `telefon_mobil` und
 * `telefon_fest`; in `leads.telefon` landet die beste (Handy zuerst).
 *
 * Reine Funktionen, kein Netz — die Abrufe macht der Aufrufer.
 */

/** Land aus der Domain: .ch → CH, .at → AT, sonst DE (nur für nationale Nummern ohne Vorwahl). */
export function landAus(website) {
  const host = String(website ?? '').toLowerCase()
  if (/\.ch(\/|$)/.test(host)) return 'CH'
  if (/\.at(\/|$)/.test(host)) return 'AT'
  return 'DE'
}

const VORWAHL = { DE: '49', AT: '43', CH: '41' }

/** Beliebige Schreibweise → +49… (E.164) oder null. */
export function normalisiereNummer(roh, land = 'DE') {
  let s = String(roh ?? '').replace(/\(0\)/g, '').replace(/[^\d+]/g, '')
  if (s.startsWith('00')) s = `+${s.slice(2)}`
  if (!s.startsWith('+')) {
    if (!s.startsWith('0')) return null
    s = `+${VORWAHL[land] ?? '49'}${s.slice(1)}`
  }
  const ziffern = s.slice(1)
  if (ziffern.length < 9 || ziffern.length > 15) return null
  if (!/^(49|43|41)/.test(ziffern)) return ziffern.length >= 10 ? s : null
  return s
}

/** Handy? DE 015x/016x/017x · AT 06xx · CH 07[5-9]. */
export function istMobil(e164) {
  return /^\+49(15|16|17)\d/.test(e164) || /^\+436\d/.test(e164) || /^\+417[5-9]\d/.test(e164)
}

/** Kandidaten mit Kontext: das Stück Text davor sagt, ob es Fax, Telefon oder Handy ist. */
const NUMMER = /(?:\+|00)\s?\d{2}[\d\s\/().\-]{6,22}\d|\b0\d{2,5}[\s\/().\-]*\d[\d\s\/().\-]{3,18}\d/g

export function kontaktAusImpressum(text, website = '') {
  const t = String(text ?? '').slice(0, 20_000)
  const land = landAus(website)
  const mobil = []
  const fest = []
  for (const m of t.matchAll(NUMMER)) {
    const davor = t.slice(Math.max(0, m.index - 28), m.index).toLowerCase()
    // Fax, Register, Steuer und Bank sind keine Rufnummern.
    if (/fax|telefax|hrb|hra|register|ust|steuer|st\.-?nr|iban|bic|konto|blz|ust-id|vat|che-/.test(davor)) continue
    const e164 = normalisiereNummer(m[0], land)
    if (!e164) continue
    const markiertMobil = /mobil|handy|mobile|cell|\bm\b|\bm:|\bm\./.test(davor)
    const liste = istMobil(e164) || (markiertMobil && !/^\+49[2-9]/.test(e164)) ? mobil : fest
    if (!mobil.includes(e164) && !fest.includes(e164)) liste.push(e164)
  }

  // E-Mail, auch in der Schreibweise „info (at) firma.de".
  const entschaerft = t
    .replace(/\s*[\[(]\s*(at|ät)\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*(dot|punkt)\s*[\])]\s*/gi, '.')
  const mails = [...new Set((entschaerft.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((x) => x.toLowerCase()))]
    .filter((x) => !/\.(png|jpe?g|gif|webp|svg)$/.test(x) && !/sentry|wixpress|example\.|domain\.|beispiel/.test(x))
  const domain = String(website ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  // Eigene Domain zuerst, Datenschutz-Postfächer zuletzt.
  mails.sort((a, b) => {
    const rang = (x) => (domain && x.endsWith(`@${domain}`) ? 0 : 1) + (/datenschutz|privacy|dsb|dpo/.test(x) ? 2 : 0)
    return rang(a) - rang(b)
  })

  return {
    telefon_mobil: mobil[0] ?? null,
    telefon_fest: fest[0] ?? null,
    telefon_alle: [...mobil, ...fest].slice(0, 5),
    email: mails[0] ?? null,
  }
}

/** Die beste Nummer für den Wähler: Handy vor Festnetz. */
export function besteNummer(k) {
  return k?.telefon_mobil ?? k?.telefon_fest ?? null
}
