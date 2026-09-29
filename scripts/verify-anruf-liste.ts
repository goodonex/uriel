/**
 * Prüft `app/src/cockpit/lib/anrufListe.ts` (29.09.2026): Gruppen, Bündelung je
 * Unternehmen, Ruhezeiten nach Anrufergebnis, Abgleich der Kaltakquise-Listen.
 * Start: npx tsx scripts/verify-anruf-liste.ts
 */
import { baueAnrufListe, normNummer, ruhtBis } from '../app/src/cockpit/lib/anrufListe'

let ok = 0
let fehl = 0
function check(name: string, bed: boolean, info = '') {
  if (bed) ok++
  else {
    fehl++
    console.log(`FAIL ${name}${info ? ` — ${info}` : ''}`)
  }
}

const JETZT = new Date('2026-09-29T12:00:00')
let n = 0
function lead(over: Record<string, unknown> = {}, profil: Record<string, unknown> = {}) {
  n++
  return {
    id: `l${n}`, brand_id: 'b', profil_key: `k${n}`, li_urn: '', profile_url: `https://linkedin.com/in/l${n}`,
    name: `Lead ${n}`, headline: 'Makler', lead_status: 'aktiv', wiedervorlage_am: null, wiedervorlage_grund: '',
    disqualifiziert_grund: '', markiert: false, notiz: '', email: '', telefon: '+4917612345' + String(n).padStart(3, '0'),
    anschrift: '', first_seen_at: '', updated_at: '',
    profil: { website: `https://firma${n}.de/`, firma: `Firma ${n}`, punkte: 40, ...profil },
    ...over,
  } as never
}
function thread(leadId: string, over: Record<string, unknown> = {}) {
  return { id: `t-${leadId}`, lead_id: leadId, status: 'active', loom_status: 'offen', last_from: 'me', starred: false, ...over } as never
}
function anruf(leadId: string, at: string, details: Record<string, unknown>) {
  return { id: `e${Math.random()}`, brand_id: 'b', lead_id: leadId, typ: 'anruf', at, quelle: 'ui', details, erstellt_at: at } as never
}

// 1. Gruppen
{
  const a = lead(), b = lead(), c = lead(), d = lead({}, { linkedin_status: 'offen' }), e = lead()
  const liste = baueAnrufListe({
    leads: [a, b, c, d, e],
    threads: [
      thread((a as { id: string }).id, { loom_status: 'verschickt' }),
      thread((b as { id: string }).id, { last_from: 'them' }),
      thread((c as { id: string }).id),
      thread((e as { id: string }).id, { loom_status: 'entfaellt' }),
    ],
    ereignisse: [], listItems: [], jetzt: JETZT,
  })
  const g = Object.fromEntries(liste.eintraege.map((x) => [x.leadId, x.gruppe]))
  check('Video raus → Gruppe 1', g.l1 === 1, JSON.stringify(g))
  check('Antwort da → Gruppe 2', g.l2 === 2)
  check('angeschrieben ohne Antwort → Gruppe 3', g.l3 === 3)
  check('Anfrage nicht angenommen → Gruppe 4', g.l4 === 4)
  check('Loom abgelehnt → nicht in der Liste', !('l5' in g))
  check('Reihenfolge folgt der Hitze', liste.eintraege.map((x) => x.gruppe).join() === '1,2,3,4')
}

// 2. Ein Unternehmen, ein Anruf
{
  const a = lead({}, { website: 'https://www.same.de', gf: 'angestellt', punkte: 30 })
  const b = lead({ name: 'Chefin' }, { website: 'https://same.de/', gf: 'gf', punkte: 30 })
  const liste = baueAnrufListe({ leads: [a, b], threads: [], ereignisse: [], listItems: [], jetzt: JETZT })
  check('zwei Kontakte derselben Domain → ein Eintrag', liste.eintraege.length === 1)
  check('der Geschäftsführer vertritt die Firma', liste.eintraege[0]?.name === 'Chefin')
  check('der andere steht unter „weitere"', liste.eintraege[0]?.weitere.length === 1)
}

// 3. Sortierung in der Gruppe: Punkte, dann Handy
{
  const a = lead({ telefon: '+4922893393533' }, { punkte: 50 })
  const b = lead({ telefon: '+491713166765' }, { punkte: 50 })
  const c = lead({}, { punkte: 70 })
  const liste = baueAnrufListe({ leads: [a, b, c], threads: [], ereignisse: [], listItems: [], jetzt: JETZT })
  check('mehr Punkte zuerst', liste.eintraege[0]?.punkte === 70)
  check('bei Gleichstand Handy vor Festnetz', liste.eintraege[1]?.nummerArt === 'mobil' && liste.eintraege[2]?.nummerArt === 'fest')
}

// 4. Ruhezeiten
{
  const nr = '+491761234500'
  check('heute schon angerufen → ruht', ruhtBis([{ at: '2026-09-29T09:00:00', details: { ergebnis: 'gesprochen' } }], nr, JETZT).ruht)
  check('nicht erreicht vor 1 Tag → ruht', ruhtBis([{ at: '2026-09-28T10:00:00', details: { ergebnis: 'nicht_erreicht' } }], nr, JETZT).ruht)
  check('nicht erreicht vor 3 Tagen → wieder dran', !ruhtBis([{ at: '2026-09-26T10:00:00', details: { ergebnis: 'nicht_erreicht' } }], nr, JETZT).ruht)
  const drei = ['2026-09-20', '2026-09-23', '2026-09-26'].map((d) => ({ at: `${d}T10:00:00`, details: { ergebnis: 'nicht_erreicht' } }))
  check('drei Fehlversuche → zwei Wochen Ruhe', ruhtBis(drei, nr, JETZT).ruht && ruhtBis(drei, nr, JETZT).versuche === 3)
  check('kein Interesse → dauerhaft raus', ruhtBis([{ at: '2026-06-01T10:00:00', details: { ergebnis: 'kein_interesse' } }], nr, JETZT).ruht)
  check('falsche Nummer → raus, solange es dieselbe ist', ruhtBis([{ at: '2026-09-01T10:00:00', details: { ergebnis: 'falsche_nummer', nummer: nr } }], nr, JETZT).ruht)
  check('falsche Nummer, neue Nummer → wieder dran', !ruhtBis([{ at: '2026-09-01T10:00:00', details: { ergebnis: 'falsche_nummer', nummer: '+4930111111' } }], nr, JETZT).ruht)
  check('Rückruf in der Zukunft → ruht', ruhtBis([{ at: '2026-09-28T10:00:00', details: { ergebnis: 'rueckruf', rueckruf_am: '2026-10-01T09:00:00' } }], nr, JETZT).ruht)
  const a = lead()
  const liste = baueAnrufListe({ leads: [a], threads: [], ereignisse: [anruf((a as { id: string }).id, '2026-09-29T08:00:00', { ergebnis: 'mailbox' })], listItems: [], jetzt: JETZT })
  check('heute Angerufene zählen, stehen aber nicht mehr in der Liste', liste.eintraege.length === 0 && liste.heuteAngerufen === 1)
}

// 5. Kaltakquise: nichts doppelt, was LinkedIn schon kennt
{
  const a = lead({ telefon: '0228 93393533' }, { website: 'https://mainka.de', firma: 'MAINKA Real Estate' })
  const item = (over: Record<string, unknown>) =>
    ({ id: `i${Math.random()}`, list_id: 'x', name: '', email: '', phone: '', company: '', linkedin_url: '', ansprechpartner: '', standort: '', aufhaenger_angriffsflaeche: '', outcome: '', prio: '', im_crm: null, g_ads: '', keyword: '', website: '', notes: '', status: 'offen', called_at: null, created_at: '', ...over }) as never
  const liste = baueAnrufListe({
    leads: [a],
    threads: [],
    ereignisse: [],
    listItems: [
      item({ phone: '+49 228 93393533', company: 'Irgendwas' }),
      item({ phone: '0228 1111111', company: 'Mainka Real Estate GmbH' }),
      item({ phone: '040 64208820', company: 'RESCHKE-IMMOBILIEN GmbH' }),
      item({ phone: '040 64208820', company: 'Reschke Dublette' }),
      item({ phone: '', company: 'Ohne Nummer' }),
    ],
    jetzt: JETZT,
  })
  const kalt = liste.eintraege.filter((e) => e.gruppe === 5)
  check('gleiche Nummer wie ein LinkedIn-Lead → nicht doppelt', !kalt.some((e) => e.nummer === '+4922893393533'))
  check('gleicher Firmenname wie ein LinkedIn-Lead → nicht doppelt', !kalt.some((e) => /mainka/i.test(e.firma)))
  check('Dubletten in der Liste → einmal', kalt.length === 1 && kalt[0].firma === 'RESCHKE-IMMOBILIEN GmbH')
}

// 6. Nummern
check('Festnetz mit Bindestrichen', normNummer('040 – 64 20 88 20') === '+494064208820')
check('Schweiz mit (0)', normNummer('+41 (0)61 599 88 99') === '+41615998899')
check('Unsinn → leer', normNummer('12345') === '')
check('zwei Nummern in einem Feld → die erste', normNummer('0176 57680650 / 040 37024629') === '+4917657680650')
check('Durchwahl-Schrägstrich bleibt eine Nummer', normNummer('0228/93393533') === '+4922893393533')

console.log(`verify-anruf-liste: ${ok} ok, ${fehl} fehlgeschlagen`)
if (fehl) process.exit(1)
