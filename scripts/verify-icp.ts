/**
 * Drift-Wache für den ICP-Filter (18.08.2026).
 *
 * Anlass: In Kevins Antworten-Zeile standen 52 Leute, über die Hälfte davon
 * Coaches, Recruiter und KI-Verkäufer, die IHN akquirieren wollten — und der
 * Nacht-Agent schrieb für 9 davon Entwürfe. Sein Satz: „Wir haben doch extra
 * einen ICP-Filter, den können wir doch auch über die offenen Nachrichten
 * laufen lassen." Konnte man nicht: Der Filter stand nur im Skill-Text.
 *
 * Zwei Dinge müssen dauerhaft stimmen:
 *   1. Oberfläche und Runner urteilen GLEICH (zwei Implementierungen, eine
 *      Regel-Datei) — sonst zeigt die Liste andere Leute, als der Agent bedient.
 *   2. Die echten Fälle vom 18.08. bleiben richtig einsortiert. Namentlich,
 *      weil eine allgemeine Regel beim nächsten Umbau leise verloren geht.
 *
 * Start: npx tsx scripts/verify-icp.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { icpUrteil, istArbeitsVorrat, threadImVorrat, type IcpUrteil } from '../app/src/cockpit/lib/icp'
import { icpUrteil as icpUrteilRunner, threadImVorrat as threadImVorratRunner } from '../runner/linkedin/icp.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/**
 * Kevins echte Antworten-Liste vom 18.08.2026, gekürzt auf die Fälle, die eine
 * Entscheidung tragen. Headline = das Feld `company` aus `linkedin_threads`.
 */
const FAELLE: Array<{ name: string; headline: string; erwartet: IcpUrteil; warum: string }> = [
  // --- Kern: die Kunden ---
  { name: 'Michaela Beer', headline: 'Immobilienmakler | Verkauf & Vermietung von Wohneigentum', erwartet: 'kern', warum: 'Berufsbezeichnung' },
  { name: 'Sepideh Bahrami', headline: 'Inhaberin Bahrami Immobilien persönlich-nah-ehrlich', erwartet: 'kern', warum: 'eigenes Maklerbüro' },
  { name: 'Mirko Roloff', headline: 'Geschäftstellenleitung bei VON POLL Immobilien', erwartet: 'kern', warum: 'Marke' },
  { name: 'Silvio Tantulli', headline: 'Lizenzpartner Evernest Münster/Münsterland', erwartet: 'kern', warum: 'Marke' },
  { name: 'Steven Koller', headline: 'Inhaber und Geschäftsführer ImmoPartner-Basel AG', erwartet: 'kern', warum: 'Immo im Firmennamen' },
  { name: 'Andreas Blasch', headline: 'Hamburg, meine Perle – Ihr Zuhause finden wir.', erwartet: 'kern', warum: 'Makler ohne das Wort Immobilie — stand am 18.08. faelschlich auf unklar' },
  { name: 'Natalie Kloppe', headline: 'CEO | Kloppestates Real Estate', erwartet: 'kern', warum: 'englisch' },

  // --- Off: die Kevin akquirieren wollten ---
  { name: 'Angelique Pein', headline: 'Kosten, Steuerfallen und Renditebremsen eliminieren.', erwartet: 'off', warum: 'Kevins Beispiel: „Hi Angelique, wonach bist du auf der Suche"' },
  { name: 'Cornelia Zaunrith', headline: '1:1 Coaching I Ich begleite High Performer', erwartet: 'off', warum: 'Coaching' },
  { name: 'Fawad Mehmood', headline: 'Technical Recruiter / Recruiter', erwartet: 'off', warum: 'Recruiting' },
  { name: 'Rémy Touzard', headline: 'Let our AI Agents prospect, qualify & book meetings for you', erwartet: 'off', warum: 'verkauft Akquise' },
  { name: 'Marco Franz', headline: 'Ich klone dich. Dein KI Klon übernimmt dein LinkedIn.', erwartet: 'off', warum: 'KI-Verkauf' },
  { name: 'Alassane Sow', headline: 'Mentor, Wachstums- & Sparringspartner für B2B Dienstleister', erwartet: 'off', warum: 'Mentor' },
  { name: 'Leo Gärtner', headline: 'Steuerrebell & Visionär ut Hamburg | Steuerparadies Deutschland', erwartet: 'off', warum: 'Steuer' },
  { name: 'Finn Korte', headline: 'Co-Founder alfima.io | Bootstrapped SaaS', erwartet: 'off', warum: 'SaaS' },
  { name: 'Sebastian Thomas', headline: 'Zertifizierter Edelmetallexperte', erwartet: 'off', warum: 'Edelmetall' },

  // --- Unklar: sichtbar lassen, NICHT wegwerfen ---
  { name: 'Norbert Reichentrog', headline: 'Geschäftsführer bei Reichentrog und Kollegen', erwartet: 'unklar', warum: 'KEVINS KUNDE — darf nie als Off aussortiert werden' },
  { name: 'Markus Sahm', headline: '--', erwartet: 'unklar', warum: 'leere Headline' },
  { name: 'LinkedIn Member', headline: '', erwartet: 'unklar', warum: 'anonymes Profil' },
]

for (const f of FAELLE) {
  const b = icpUrteil(f.headline, f.name)
  check(
    `${f.name} → ${f.erwartet} (${f.warum})`,
    b.urteil === f.erwartet,
    `bekommen: ${b.urteil}${b.grund ? ` wegen „${b.grund}"` : ''} · Headline: ${f.headline}`,
  )
}

// --- Oberfläche und Runner müssen gleich urteilen -----------------------
for (const f of FAELLE) {
  const a = icpUrteil(f.headline, f.name).urteil
  const b = (icpUrteilRunner as (h: string, n: string) => { urteil: IcpUrteil })(f.headline, f.name).urteil
  check(`Cockpit und Runner urteilen gleich über ${f.name}`, a === b, `Cockpit ${a} · Runner ${b}`)
}

// --- Die Richtung des Fehlers -------------------------------------------
check(
  'unklar zählt zum Arbeitsvorrat',
  istArbeitsVorrat('unklar') && istArbeitsVorrat('kern') && istArbeitsVorrat('rand'),
  'Ein übersehener Makler ist teurer als ein Name zu viel in der Liste.',
)
check('nur off fällt heraus', !istArbeitsVorrat('off'))
check(
  'wer sich selbst Makler nennt, überlebt ein Off-Wort in derselben Zeile',
  icpUrteil('Immobilienmakler | Berater für Wachstum', 'Test').urteil === 'kern',
  'Sonst fielen echte Makler mit einem beliebten Zusatz heraus.',
)
check(
  'ein Coach FÜR Makler bleibt draußen (Wettbewerb, so steht es im Skill)',
  icpUrteil('Coaching für Immobilienmakler — mehr Abschlüsse', 'Test').urteil === 'off',
)

// --- Thread-Regel: Agenten-Urteil vor Headline (01.10.2026) --------------
// Metin Moser-Balci stand seit August in jeder Antworten-Liste (Headline
// `unklar`, Urteil `kontakt`), Manuel Rees fehlte (Urteil `lead`, Headline `off`).
const METIN_HEADLINE =
  'Gesundheits- & Sozialmanager bei HESA Statik Pulse | Prozessoptimierung, Interim Management'
const THREAD_FAELLE: Array<{ label: string; t: Record<string, unknown>; erwartet: boolean }> = [
  {
    label: 'Metin: Urteil kontakt, seither nichts Neues → raus',
    t: { name: 'Metin Moser-Balci', company: METIN_HEADLINE, agent_urteil: 'kontakt', agent_urteil_at: '2026-10-01T10:38:06Z', last_from: 'them', last_message_at: '2026-08-19T19:50:42Z' },
    erwartet: false,
  },
  {
    label: 'Kontakt schreibt NACH dem Urteil neu → wieder drin (neu urteilen)',
    t: { name: 'Metin Moser-Balci', company: METIN_HEADLINE, agent_urteil: 'kontakt', agent_urteil_at: '2026-10-01T10:38:06Z', last_from: 'them', last_message_at: '2026-10-02T09:00:00Z' },
    erwartet: true,
  },
  {
    label: 'Akquise bleibt raus, auch nach neuer Nachricht',
    t: { name: 'X', company: 'Immobilienmakler', agent_urteil: 'akquise', agent_urteil_at: '2026-09-01T00:00:00Z', last_from: 'them', last_message_at: '2026-10-02T09:00:00Z' },
    erwartet: false,
  },
  {
    label: 'Lead-Urteil holt eine Off-Headline zurück',
    t: { name: 'Manuel Rees', company: '1:1 Coaching für Unternehmer', agent_urteil: 'lead', last_from: 'them' },
    erwartet: true,
  },
  { label: 'ohne Urteil: unklare Headline bleibt drin', t: { name: 'Y', company: METIN_HEADLINE, agent_urteil: null }, erwartet: true },
  { label: 'ohne Urteil: Off-Headline bleibt raus', t: { name: 'Z', company: 'Technical Recruiter / Recruiter', agent_urteil: null }, erwartet: false },
]
for (const f of THREAD_FAELLE) {
  const app = threadImVorrat(f.t)
  const runner = threadImVorratRunner(f.t)
  check(`Thread-Regel: ${f.label}`, app === f.erwartet, `erwartet ${f.erwartet}, Oberfläche ${app}`)
  check(`Thread-Regel gleich in Runner und Oberfläche: ${f.label}`, app === runner, `Oberfläche ${app}, Runner ${runner}`)
}

// --- Eine Regel-Datei, zwei Leser ---------------------------------------
const appQuelle = lies('app/src/cockpit/lib/icp.ts')
const runnerQuelle = lies('runner/linkedin/icp.mjs')
check(
  'die Oberfläche liest die gemeinsame Regel-Datei',
  /from '\.\/icpRegeln\.json'/.test(appQuelle),
)
check(
  'der Runner liest DIESELBE Datei, statt die Liste zu kopieren',
  /icpRegeln\.json/.test(runnerQuelle) && !/"immobilienmakler"/.test(runnerQuelle),
  'Zwei Wortlisten laufen auseinander, sobald Kevin einen Begriff ergänzt.',
)
const regeln = JSON.parse(lies('app/src/cockpit/lib/icpRegeln.json'))
for (const topf of ['kern', 'rand', 'off']) {
  check(`Regel-Topf „${topf}" ist gefüllt`, Array.isArray(regeln[topf]) && regeln[topf].length > 0)
  check(
    `Regel-Topf „${topf}" ist kleingeschrieben (der Abgleich normalisiert)`,
    regeln[topf].every((w: string) => w === w.toLowerCase()),
  )
}

console.log(`\nverify-icp: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
