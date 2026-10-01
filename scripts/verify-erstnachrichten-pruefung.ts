/**
 * Wache für die Stufe „Prüfen" vor den Erstnachrichten (01.10.2026).
 * Ein Fall mit PRÜFEN-Hinweis oder ohne Website steht nicht in der
 * Erstnachrichten-Spur, bis Kevin den Haken gesetzt hat.
 *
 * Start: npx tsx scripts/verify-erstnachrichten-pruefung.ts
 */
import { erstnachrichtPosten } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import { brauchtPruefung, heuteGeprueft, pruefLink, trennePruefHinweis } from '../app/src/cockpit/lib/erstnachrichtenPruefung'
import type { Erstnachricht } from '../app/src/hooks/useErstnachrichten'

let pass = 0
let fail = 0
function check(label: string, ok: boolean) {
  if (ok) {
    pass++
    console.log(`  ok: ${label}`)
  } else {
    fail++
    console.error(`  FEHLT: ${label}`)
  }
}

const basis: Erstnachricht = {
  id: 'a', gruppe: 'g', name: 'Angeline Dhillon', firma: 'Sellavie Immobilien GmbH', website: 'sellavie.ch',
  nachricht: 'Moin Angeline', sort_index: 1, status: 'offen', sent_at: null,
}
const mitHinweis = { ...basis, id: 'b', firma: 'Sellavie Immobilien GmbH · PRÜFEN: Seite im Umbau' }
const ohneSeite = { ...basis, id: 'c', website: '' }
const geprueft = { ...mitHinweis, id: 'd', geprueft_at: '2026-10-01T09:00:00Z' }
const gesendet = { ...mitHinweis, id: 'e', status: 'gesendet' as const }

check('sauberer Text braucht keine Prüfung', !brauchtPruefung(basis))
check('PRÜFEN-Hinweis braucht Prüfung', brauchtPruefung(mitHinweis))
check('ohne Website braucht Prüfung', brauchtPruefung(ohneSeite))
check('abgehakt braucht keine Prüfung mehr', !brauchtPruefung(geprueft))
check('gesendet braucht keine Prüfung', !brauchtPruefung(gesendet))

const t = trennePruefHinweis(mitHinweis.firma)
check('Firma und Hinweis getrennt', t.firma === 'Sellavie Immobilien GmbH' && t.hinweis === 'Seite im Umbau')
check('ohne Marke bleibt die Firma ganz', trennePruefHinweis('A GmbH').hinweis === '' && trennePruefHinweis(null).firma === '')

const posten = erstnachrichtPosten([basis, mitHinweis, ohneSeite, geprueft])
const ids = posten.map((p) => p.id)
check('Erstnachrichten-Spur zeigt nur Sauberes und Abgehaktes', ids.length === 2 && ids.includes('erstnachricht:a') && ids.includes('erstnachricht:d'))

check('Link: Website, wenn es eine gibt', pruefLink(basis).href === 'https://sellavie.ch')
check('Link: sonst Google-Suche mit Firma und Name', pruefLink(ohneSeite).href.startsWith('https://www.google.com/search?q=Sellavie'))
check('heute abgehakt erkannt', heuteGeprueft(geprueft, new Date('2026-10-01T15:00:00Z')) && !heuteGeprueft(geprueft, new Date('2026-10-02T15:00:00Z')) && !heuteGeprueft(basis, new Date()))

console.log(`\n${pass} ok, ${fail} fehlen`)
process.exit(fail ? 1 : 0)
