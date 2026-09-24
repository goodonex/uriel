/**
 * Drift-Wache für das Angebot (20.09.2026).
 *
 * **Was hier NICHT geprüft wird:** ob ein Angebot signiert werden darf. Das
 * entscheidet die Datenbank — die Edge Function schreibt mit der Bedingung
 * `status = 'versendet'`, ein Trigger sperrt jede Änderung an einem signierten
 * Angebot. Diese Regel hier nachzubauen hiesse, zwei Wege zu derselben
 * Wahrheit zu haben, und genau das ist der Fehler, den dieses Repo schon
 * zweimal bezahlt hat.
 *
 * Geprüft wird, was die Oberfläche entscheidet: welcher Knopf angeboten wird,
 * was als Status dasteht, wann etwas abgelaufen ist, und welches Angebot die
 * Rechnung vorbelegt.
 *
 * Start: npx tsx scripts/verify-angebot.ts
 */
import type { Angebot, AngebotStatus } from '../app/src/types/db'
import { readFileSync } from 'node:fs'
import { waehleLeads } from '../supabase/functions/angebot/leadZuordnung'
import {
  ANGEBOT_STATUS_TITEL,
  angebotsSumme,
  angezeigterStatus,
  darfWechseln,
  istAbgelaufen,
  istEndstation,
  istOffen,
  letztesSigniertes,
  offeneAngebote,
} from '../app/src/cockpit/lib/angebotRegeln'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-09-20T12:00:00.000Z')

let nr = 0
function angebot(teil: Partial<Angebot> = {}): Angebot {
  nr++
  return {
    id: `a${nr}`,
    brand_id: 'b1',
    contact_id: 'c1',
    lead_id: null,
    token: '0'.repeat(32),
    paket: 'funnel',
    titel: 'Eigentümer-Funnel',
    beschreibung: '',
    betrag: 5000,
    retainer_paket: null,
    retainer_betrag: null,
    status: 'versendet',
    gueltig_bis: '2026-10-04',
    versendet_am: '2026-09-20T09:00:00.000Z',
    signiert_am: null,
    signiert_name: null,
    signiert_ip: null,
    signiert_ua: null,
    notiz: '',
    erstellt_at: '2026-09-20T09:00:00.000Z',
    updated_at: '2026-09-20T09:00:00.000Z',
    ...teil,
  }
}

{
  check('aus dem Entwurf geht es nur nach versendet oder abgelehnt',
    darfWechseln('entwurf', 'versendet') && darfWechseln('entwurf', 'abgelehnt') &&
    !darfWechseln('entwurf', 'signiert'),
    'Ein Entwurf darf nicht unterschreibbar sein — sonst steht er signierbar im Netz, bevor Kevin ihn freigegeben hat.')
  check('signiert ist Endstation', istEndstation('signiert') && !darfWechseln('signiert', 'abgelehnt'))
  check('abgelehnt ist Endstation', istEndstation('abgelehnt'))
  check('ein abgelaufenes Angebot laesst sich neu verschicken', darfWechseln('abgelaufen', 'versendet'))
  const alle: AngebotStatus[] = ['entwurf', 'versendet', 'signiert', 'abgelehnt', 'abgelaufen']
  check('jeder Status hat eine Beschriftung', alle.every((s) => ANGEBOT_STATUS_TITEL[s].length > 0))
}

{
  // Die Tagesgrenze: „gültig bis 20.09." heisst, der 20.09. gilt noch.
  check('am letzten Gueltigkeitstag laeuft nichts ab',
    !istAbgelaufen(angebot({ gueltig_bis: '2026-09-20' }), JETZT),
    'Wer auf die Sekunde rechnet, laesst das Angebot um Mitternacht des Vortags verfallen.')
  check('am Tag danach ist es abgelaufen', istAbgelaufen(angebot({ gueltig_bis: '2026-09-19' }), JETZT))
  check('ein signiertes Angebot laeuft nie ab',
    !istAbgelaufen(angebot({ gueltig_bis: '2020-01-01', status: 'signiert' }), JETZT))
  check('ein abgelehntes Angebot laeuft nie ab',
    !istAbgelaufen(angebot({ gueltig_bis: '2020-01-01', status: 'abgelehnt' }), JETZT))
}

{
  check('abgelaufen wird angezeigt, auch wenn die Zeile noch versendet sagt',
    angezeigterStatus(angebot({ gueltig_bis: '2026-09-01' }), JETZT) === 'abgelaufen',
    'Sonst steht ein totes Angebot als „Verschickt" da, nur weil niemand einen Zeitgeber gebaut hat.')
  check('ein gueltiges bleibt versendet', angezeigterStatus(angebot(), JETZT) === 'versendet')
  check('offen sind Entwurf und Verschickt',
    istOffen(angebot({ status: 'entwurf' }), JETZT) && istOffen(angebot(), JETZT))
  check('abgelaufen ist nicht mehr offen', !istOffen(angebot({ gueltig_bis: '2026-09-01' }), JETZT))
  check('signiert ist nicht mehr offen', !istOffen(angebot({ status: 'signiert' }), JETZT))
}

{
  const liste = [
    angebot({ status: 'entwurf' }),
    angebot(),
    angebot({ status: 'signiert', signiert_am: '2026-09-10T10:00:00.000Z' }),
    angebot({ gueltig_bis: '2026-08-01' }),
  ]
  check('offeneAngebote zaehlt genau die zwei offenen', offeneAngebote(liste, JETZT).length === 2,
    JSON.stringify(offeneAngebote(liste, JETZT).map((a) => a.id)))
}

{
  const alt = angebot({ status: 'signiert', signiert_am: '2026-05-01T10:00:00.000Z', betrag: 3500 })
  const neu = angebot({ status: 'signiert', signiert_am: '2026-09-01T10:00:00.000Z', betrag: 5000 })
  check('die Rechnung haengt am zuletzt unterschriebenen Angebot',
    letztesSigniertes([alt, neu])?.id === neu.id,
    'Ein Kunde kann nachbuchen — dann ist das juengste die Wahrheit fuer die naechste Rechnung.')
  check('ohne Unterschrift gibt es keins', letztesSigniertes([angebot()]) === null)
}

{
  const s = angebotsSumme(angebot({ betrag: 5000, retainer_betrag: 2000 }))
  check('Festpreis und Retainer bleiben zwei Zahlen',
    s.einmalig === 5000 && s.monatlich === 2000,
    'Eine Summe aus einmalig und monatlich gaebe es in der Wirklichkeit nicht.')
  check('ohne Retainer ist die monatliche Zahl leer, nicht null Euro',
    angebotsSumme(angebot()).monatlich === null)
}

// Der LinkedIn-Lead zum Kontakt (24.09.2026): Beim Unterschreiben wurde nur der
// Kontakt „Deal", der Lead lief in der Nachfass-Kadenz weiter.
{
  const leer = { angebotLeadId: null, verlaufLeadIds: [] as string[], namensTreffer: [] as string[] }
  check('ein Lead am Angebot geht vor', waehleLeads({ ...leer, angebotLeadId: 'a', verlaufLeadIds: ['b'] }).leadIds.join() === 'a')
  const v = waehleLeads({ ...leer, verlaufLeadIds: ['b', 'b'], namensTreffer: ['c'] })
  check('der Verlauf schlägt den Namen', v.weg === 'verlauf' && v.leadIds.join() === 'b' && v.angebotLeadId === 'b')
  const firma = waehleLeads({ ...leer, verlaufLeadIds: ['b', 'c'] })
  check('eine Firma mit zwei Ansprechpartnern: beide Kunde, am Angebot keiner', firma.leadIds.length === 2 && firma.angebotLeadId === null)
  check('der Name allein reicht, wenn er eindeutig war', waehleLeads({ ...leer, namensTreffer: ['c'] }).angebotLeadId === 'c')
  check('nichts gefunden heißt: kein Lead wird angefasst', waehleLeads(leer).leadIds.length === 0)
  const fn = readFileSync(new URL('../supabase/functions/angebot/index.ts', import.meta.url), 'utf8')
  check('die Unterschrift sucht den Lead selbst', /await findeLeads\(db,/.test(fn) && /for \(const leadId of zuordnung\.leadIds\)/.test(fn))
  const regel = readFileSync(new URL('../supabase/functions/angebot/leadZuordnung.ts', import.meta.url), 'utf8')
  check('mehrdeutige Namen zählen nicht', /if \(treffer\?\.length === 1\)/.test(regel))
}

console.log(`\nverify-angebot: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
