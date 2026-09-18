/**
 * Drift-Wache für die Coach-Auswertung (17.09.2026).
 *
 * Start: npx tsx scripts/verify-coach-auswertung.ts
 */
import { coachAuswertung, coachText, coachWoche, coachZahlen, type CoachTageszeile } from '../app/src/cockpit/lib/coachAuswertung'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const leer: Omit<CoachTageszeile, 'datum'> = {
  li_anfragen: 0, li_nachrichten: 0, inmails: 0, looms: 0, li_followups: 0, ig_followups: 0, call_followups: 0,
  antworten_li: 0, termine_li: 0, termine_ig: 0, termine_call: 0, quali_termine: 0, sales_calls: 0, abschluesse: 0, umsatz: 0,
}
const tag = (datum: string, teil: Partial<CoachTageszeile> = {}): CoachTageszeile => ({ ...leer, datum, ...teil })

// ── Die Woche ──
const donnerstag = new Date('2026-09-17T20:00:00')
check('Do abends: Fr–Do bis heute', JSON.stringify(coachWoche(donnerstag)) === JSON.stringify({ von: '2026-09-11', bis: '2026-09-17', kw: 38 }), JSON.stringify(coachWoche(donnerstag)))
check('Fr früh: noch die abgeschlossene Woche', coachWoche(new Date('2026-09-18T08:00:00')).bis === '2026-09-17')
check('Mi: Woche endet am Do davor', coachWoche(new Date('2026-09-16T12:00:00')).bis === '2026-09-10')
check('eine zurück', coachWoche(donnerstag, 1).von === '2026-09-04' && coachWoche(donnerstag, 1).bis === '2026-09-10')
check('KW 1 über Jahreswechsel', coachWoche(new Date('2027-01-07T12:00:00')).kw === 1)

// ── Zahlen ──
const eingabe = {
  tageszeilen: [
    tag('2026-09-10', { li_anfragen: 99, li_nachrichten: 50 }), // Donnerstag davor — gehört nicht rein
    tag('2026-09-11', { li_anfragen: 40, li_nachrichten: 5, termine_li: 1 }),
    tag('2026-09-17', { li_anfragen: 40, li_nachrichten: 30, looms: 3, abschluesse: 1, umsatz: 5000, quali_termine: 1 }),
  ],
  erstnachrichten: [
    ...Array.from({ length: 38 }, () => ({ status: 'gesendet', sent_at: '2026-09-16T10:00:00Z' })),
    { status: 'offen', sent_at: null },
  ],
  netzwerk: [
    { status: 'angenommen', eingeladen_at: null, angenommen_at: '2026-09-12T10:00:00Z' },
    { status: 'offen', eingeladen_at: '2026-09-12T10:00:00Z', angenommen_at: null },
  ],
  ereignisse: [
    { lead_id: 'a', typ: 'loom_gesendet', at: '2026-09-15T10:00:00Z' },
    { lead_id: 'a', typ: 'loom_gesendet', at: '2026-09-15T10:05:00Z' },
    { lead_id: 'b', typ: 'followup', at: '2026-09-01T10:00:00Z' },
    { lead_id: 'b', typ: 'loom_zugesagt', at: '2026-09-05T10:00:00Z' },
    { lead_id: 'b', typ: 'loom_gesendet', at: '2026-09-16T10:00:00Z' },
    { lead_id: 'c', typ: 'inmail', at: '2026-09-02T10:00:00Z' },
    { lead_id: 'c', typ: 'followup', at: '2026-09-03T10:00:00Z' },
    { lead_id: 'c', typ: 'loom_gesendet', at: '2026-09-16T11:00:00Z' },
    { lead_id: 'd', typ: 'loom_zugesagt', at: '2026-09-05T10:00:00Z' },
    { lead_id: 'd', typ: 'followup', at: '2026-09-06T10:00:00Z' },
    { lead_id: 'd', typ: 'loom_gesendet', at: '2026-09-16T12:00:00Z' },
  ],
  jetzt: donnerstag,
}
const z = coachZahlen(eingabe, '2026-09-11', '2026-09-17')
check('Anfragen: gezählt, Vortag draussen', z.anfragen === 80, String(z.anfragen))
check('Nachrichten: Maximum der Quellen, nicht Summe', z.liNachrichten === 38, String(z.liNachrichten))
check('Looms: ein Lead = ein Loom', z.looms === 4, String(z.looms))
check('Follow-up vor Zusage → Follow-up-Block', z.fuLooms === 1, String(z.fuLooms))
check('InMail schlägt Follow-up', z.inmailLooms === 1, String(z.inmailLooms))
check('Follow-up nach Zusage → LinkedIn', z.liLooms === 2, String(z.liLooms))
check('Angenommen', z.angenommen === 1)

const ohneZaehler = coachZahlen({ ...eingabe, tageszeilen: [] }, '2026-09-11', '2026-09-17')
check('Anfragen-Formel aus Lektion 42, wenn nichts gezählt', ohneZaehler.anfragen === 2, String(ohneZaehler.anfragen))

// ── Raster ──
const a = coachAuswertung(eingabe)
check('Blockreihenfolge wie im Sheet', a.bloecke.map((b) => b.id).join(',') === 'anfragen,linkedin,followup,inmail,gesamt,standards')
const li = a.bloecke.find((b) => b.id === 'linkedin')!
check(
  'Zeilenreihenfolge wie im Sheet',
  li.zeilen.map((r) => r.label).join('|') ===
    'Versendete Nachrichten|Loom zugesendet|Conv. Nachricht → Loom|Quali-Call-Termine|Conv. Loom → Quali-Call|Kunden|Conv. Quali-Call → Kunde',
)
const fu = a.bloecke.find((b) => b.id === 'followup')!
check('Nicht erfasst ist null, nicht 0', fu.zeilen[3].woche === null && fu.zeilen[4].woche === null)
check('Quote ohne Nenner ist null', a.bloecke.find((b) => b.id === 'inmail')!.zeilen[2].woche === null)
const wertLoom = a.bloecke.find((b) => b.id === 'gesamt')!.zeilen.find((r) => r.label === 'Wert pro Loom')!
check('Wert pro Loom', wertLoom.woche === 1250, String(wertLoom.woche))
check('Text enthält KW', coachText(a).startsWith('KW 38 · 11.09.–17.09.2026'))

console.log(`${pass} ok, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
