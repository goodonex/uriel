/**
 * Prüft die Ausschluss-Regel für Recherchierte Leads (03.10.2026):
 * list_type 'recherchiert' bleibt aus den Kaltakquise-Listen, kommt als
 * Gruppe 6 hinter die Kaltakquise und wird gegen LinkedIn/Kaltakquise entdoppelt.
 * Start: npx tsx scripts/verify-listen-quellen.ts
 */
import { baueAnrufListe } from '../app/src/cockpit/lib/anrufListe'
import { trenneListen } from '../app/src/cockpit/lib/listenQuellen'

let fehl = 0
const check = (n: string, b: boolean) => { if (!b) { fehl++; console.log(`FAIL ${n}`) } }

const t = trenneListen([{ id: 'a', list_type: 'static' }, { id: 'b', list_type: 'dynamic' }, { id: 'c', list_type: 'recherchiert' }, { id: 'd' }])
check('kaltakquise ohne recherchiert', t.kaltakquise.map((l) => l.id).join() === 'a,b,d')
check('recherchiert getrennt', t.recherchiert.map((l) => l.id).join() === 'c')

const item = (id: string, phone: string, company: string, website = '') =>
  ({ id, list_id: 'x', name: company, phone, company, website, status: 'offen', called_at: null, prio: 'A', linkedin_url: '', ansprechpartner: '', standort: '', aufhaenger_angriffsflaeche: '', notes: '' }) as never
const kalt = [item('k1', '+4917611111111', 'Alpha GmbH', 'https://alpha.de')]
const rech = [
  item('r1', '+4917622222222', 'Beta GmbH', 'https://beta.de'),
  item('r2', '+4917611111111', 'Gamma', 'https://gamma.de'), // Nummer wie Kaltakquise
  item('r3', '+4917633333333', 'Alpha Immobilien', 'https://alpha.de'), // Domain wie Kaltakquise
]
const l = baueAnrufListe({ leads: [], threads: [], ereignisse: [], listItems: kalt, recherchierteItems: rech, jetzt: new Date('2026-10-03T12:00:00') })
check('Kaltakquise = Gruppe 5', l.jeGruppe[5] === 1)
check('Recherchiert = Gruppe 6, dedupliziert', l.jeGruppe[6] === 1 && l.eintraege.find((e) => e.gruppe === 6)?.listItemId === 'r1')
check('Reihenfolge: 5 vor 6', l.eintraege[0].gruppe === 5 && l.eintraege[1].gruppe === 6)
const ohne = baueAnrufListe({ leads: [], threads: [], ereignisse: [], listItems: kalt, jetzt: new Date('2026-10-03T12:00:00') })
check('ohne recherchierte unverändert', ohne.eintraege.length === 1 && ohne.jeGruppe[6] === 0)
console.log(fehl ? `${fehl} FEHLER` : 'OK verify-listen-quellen')
process.exit(fehl ? 1 : 0)
