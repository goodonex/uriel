/**
 * scripts/verify-erstnachrichten-ablauf.ts — der A-bis-Z-Ablauf der
 * Erstnachrichten (23.09.2026) an Kevins eigenen Fällen.
 *
 * Kevin am 23.09. nach sieben Nachrichten, von denen fünf nicht rausgehen
 * konnten: *„Wenn wir eine Änderung da drinnen nehmen, dass alles, was danach
 * folgt, immer diese Änderung mit drin hat."* Diese Prüfung hält fest, was der
 * Code (nicht das Modell) entscheidet: welcher Ansatz, wer gar keine Nachricht
 * bekommt, und dass das Regelwerk keine abgeschafften Sätze mehr erlaubt.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/verify-erstnachrichten-ablauf.ts
 */
// @ts-expect-error — .mjs ohne Typen
import { ansatzFuer } from '../runner/linkedin/erstnachrichtenAblauf.mjs'
// @ts-expect-error — .mjs ohne Typen
import { istVeraltet, regelwerk, QUELLE_PRAEFIX } from '../runner/regeln/fassung.mjs'

let fehler = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) fehler++
}

const heute = new Date('2026-09-23T12:00:00Z')
const lead = (recherche: Record<string, unknown>) => ({ name: 'X', profil_key: 'x', recherche })

/* ── Kevins Fälle vom 23.09. ─────────────────────────────────────────── */
{
  // Amoreal / Assetnow: „Die Seite ist zu gut" — keine Nachricht, eigener Ansatz offen.
  const kraus = ansatzFuer(lead({ website: 'https://amoreal.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'nein', rolle: 'inhaber' }), heute)
  check('Kraus (Amoreal): gute Seite → zurückgestellt, keine Analyse', 'zurueck' in kraus, kraus)
  const stark = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'stark', wow_potenzial: 'ja' }), heute)
  check('Stufe „stark" sticht jedes Wow-Urteil', 'zurueck' in stark, stark)
  const knapp = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'knapp' }), heute)
  check('„knapp" bekommt die Analyse (25.09.2026)', 'ansatz' in knapp && knapp.ansatz === 'analyse', knapp)
  const alt = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide' }), heute)
  check('Recherche ohne Wow-Urteil (vor dem 23.09.) → prüfen statt raten', 'zurueck' in alt && /prüfen/.test(alt.zurueck), alt)

  // Hilgeland: laut Impressum nicht Entscheider, eigene Firmen nebenher → Rapport.
  const hilgeland = ansatzFuer(
    lead({
      firma: 'MAUS Immobilien GmbH',
      website: 'https://maus-sylt.de/',
      erreichbar: 'ja',
      rolle: 'angestellt',
      rolle_impressum: 'angestellt',
      website_stufe: 'solide',
      wow_potenzial: 'ja',
      stationen: [
        { firma: 'MAUS Immobilien GmbH', rolle: 'Makler', seit: '2019', selbststaendig: false },
        { firma: 'CheckOut Sylt', rolle: 'Inhaber', seit: '2021', selbststaendig: true },
      ],
    }),
    heute,
  )
  check('Hilgeland (Maus Sylt): Nebenfirma → Rapport, keine Kritik an der Maus-Seite', (hilgeland as any).ansatz === 'nebenfirma', hilgeland)

  // Geschwendtas / Krupka: schwache Seite mit echtem Potenzial → Nachricht.
  const schwach = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'schwach', wow_potenzial: 'ja', rolle: 'inhaber' }), heute)
  check('Schwache Seite mit Wow-Potenzial → die Seite ist das Thema', (schwach as any).ansatz === 'seite-ist-das-thema', schwach)
  const ordentlich = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', zeitgemaess: 'ja', wow_potenzial: 'ja', rolle: 'inhaber' }), heute)
  check('Solide Seite mit echtem Potenzial → Analyse', (ordentlich as any).ansatz === 'analyse', ordentlich)
}

/* ── die übrigen Ansätze ─────────────────────────────────────────────── */
{
  const pe = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'ja', geschaeftsmodell: 'projektentwickler' }), heute)
  check('Projektentwickler bekommt den eigenen Winkel', (pe as any).ansatz === 'projektentwickler', pe)
  const offline = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'offline' }), heute)
  check('Seite offline → eigener Aufbau', (offline as any).ansatz === 'seite-offline', offline)
  const frisch = ansatzFuer(lead({ website: '', stationen: [{ firma: 'R&R Projektentwicklung', seit: 'Aug. 2026', selbststaendig: true }] }), heute)
  check('Frisch gegründet ohne Seite → erst Rapport', (frisch as any).ansatz === 'frisch-ohne-seite', frisch)
  const ohne = ansatzFuer(lead({ website: '', stationen: [{ firma: 'Alt GmbH', seit: '2012', selbststaendig: true }] }), heute)
  check('Keine Seite, lange am Markt → „Wo finde ich euch?"', (ohne as any).ansatz === 'keine-seite', ohne)
}

/* ── Regelwerk und Fassung ───────────────────────────────────────────── */
{
  const r = regelwerk()
  check('Fassung ist ein stabiler Hash', /^[0-9a-f]{10}$/.test(r.fassung) && regelwerk().fassung === r.fassung, r.fassung)
  check('Quelle trägt die Fassung', r.quelle === `${QUELLE_PRAEFIX}@${r.fassung}`, r.quelle)
  // Die abgeschafften Sätze dürfen nur noch unter „Abgeschafft" stehen, nie als erlaubter Schluss.
  const erlaubt = r.schreiben.split('**Abgeschafft')[0]
  check('Mandate-Frage ist kein erlaubter Schluss mehr', !erlaubt.includes('Wie kommen die Mandate aktuell rein?'))
  check('GF-Zuständigkeitsfrage ist kein erlaubter Schluss mehr', !erlaubt.includes('oder liegt das bei der Geschäftsführung?'))
  check('Wertrechner ist ausdrücklich nie der Aufhänger', /Wertrechner oder das Bewertungstool/.test(r.schreiben))
  check('Prüfer kennt Kevins Fälle vom 23.09.', ['MEISSLER', 'Amoreal', 'Assetnow', 'MAUS'].every((f) => r.pruefen.includes(f)))
}

/* ── veraltet oder nicht ─────────────────────────────────────────────── */
{
  const q = regelwerk().quelle
  check('offen, alte Fassung → veraltet', istVeraltet({ status: 'offen', quelle_datei: QUELLE_PRAEFIX }, q))
  check('offen, aktuelle Fassung → nicht veraltet', !istVeraltet({ status: 'offen', quelle_datei: q }, q))
  check('gesendet bleibt immer unberührt', !istVeraltet({ status: 'gesendet', quelle_datei: QUELLE_PRAEFIX }, q))
  check('von Hand angelegt bleibt unberührt', !istVeraltet({ status: 'offen', quelle_datei: 'LinkedIn-Leads Erstnachrichten (Juli 2026).md' }, q))
}

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nAlles grün.')
process.exit(fehler ? 1 : 0)
