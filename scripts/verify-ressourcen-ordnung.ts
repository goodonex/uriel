/**
 * Verifikation für die Ordnung der Ressourcen (25.09.2026).
 *
 * Die Gefahr ist die stille Drift: eine Datei rutscht wegen eines Musters in
 * den falschen Schritt, oder eine neue Datei verschwindet. Geprüft wird gegen
 * die echte Dateiliste vom 25.09. (Spiegel `sales_library`).
 *
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-ressourcen-ordnung.ts
 */
import { ordneRessourcen } from '../app/src/cockpit/lib/ressourcenOrdnung'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

const V = '03 Bereiche/Vertrieb & Outreach/'
const vault = [
  'Tagesplan – Gewinnbringende Aktivitäten (Stand 2026-09-15).md',
  'Outbound-Skripte 1b – Follow-ups (LinkedIn, digital-only).md',
  'Outbound-Skripte 1 – LinkedIn & Loom (Herrmann & Co).md',
  'Gesamtübersicht Vertrieb & Positionierung (Stand 2026-08-06).md',
  'Big-Mäc-Methode – Methoden-Doku (Stand 2026-08-12).md',
  'LinkedIn-Leads Erstnachrichten (Juli 2026).md',
  'Angebots-Dokument – Aufbau & Regeln (Stand 2026-09-02).md',
  'Funnel-Audit – Verfahren für die Loom-Analyse (Stand 2026-09-02).md',
  'Whale-Liste DACH – Die größten Makler (Stand 2026-09).md',
  'Loom-Skript (vollständige Sprechfassung).md',
  'Outbound-Skripte 2 – Setting & Closing (Herrmann & Co).md',
  'Loom — Nur Sprechfassung (zum Vorlesen).md',
  'Sales-Präsentation – Regie (Stand 2026-08-19).md',
  'Gesamtreview Touchpoints & Auffindbarkeit (Stand 2026-08-05).md',
  'Zielgruppenverständnis – Immobilienmakler DACH (Stand 2026-08-04).md',
  'Positionierung & Angebot – Eigentümer-Funnel (Stand 2026-08-03).md',
  'Content-Strategie HERRMANN & CO.md',
  'Angebot & Wertanalyse – Eigentümer-Funnel (Stand 2026-08-04).md',
  'LinkedIn-Funnel Baseline (Juli 2026).md',
  'Outbound-Skripte 2b – Setting-Skript (Probemitarbeiter).md',
  'Vertrieb & Outreach.md',
].map((name) => ({ name, path: V + name, kind: 'md' as const, mtime: '' }))

const skripte = [
  ['00 Loom-Warteschlange (Stand 2026-08-19).md', 'Loom-Skripte/00 Loom-Warteschlange (Stand 2026-08-19).md', 'md'],
  ['00 Loom-Warteschlange (Stand 2026-08-26).md', 'Loom-Skripte/00 Loom-Warteschlange (Stand 2026-08-26).md', 'md'],
  ['Loom-Batch 2026-08-26 — Jophiel-Briefings.md', 'Loom-Skripte/Loom-Batch 2026-08-26 — Jophiel-Briefings.md', 'md'],
  ['follow-up-analyse-template-v2.html', 'follow-up-analyse-template-v2.html', 'html'],
  ['Follow-up-Analyse V2 (Template).pdf', 'Follow-up-Analyse V2 (Template).pdf', 'pdf'],
  ['follow-up-analyse-rubrik.md', 'follow-up-analyse-rubrik.md', 'md'],
  ['Follow-up-Analyse (Muster).pdf', 'Follow-up-Analyse (Muster).pdf', 'pdf'],
].map(([name, rel, kind]) => ({ name, rel, kind: kind as 'md' | 'html' | 'pdf', mtime: '' }))

const ordnung = ordneRessourcen({ vault, skripte })
const titelJe = Object.fromEntries(ordnung.map((g) => [g.schritt.id, g.eintraege.map((e) => e.titel)]))

check('Schritte in Ablauf-Reihenfolge', ordnung.map((g) => g.schritt.id), ['tag', 'erst', 'nach', 'loom', 'gespraech', 'angebot', 'hintergrund'])
check('Tagesplan steht allein vorn', titelJe.tag, ['Tagesplan – Gewinnbringende Aktivitäten'])
check('Erstkontakt: Skript vor Juli-Nachrichten', titelJe.erst, ['Outbound-Skripte 1 – LinkedIn & Loom', 'LinkedIn-Leads Erstnachrichten'])
check('Nachfassen beginnt mit dem Follow-up-Skript', titelJe.nach[0], 'Outbound-Skripte 1b – Follow-ups (LinkedIn, digital-only)')
check('Loom beginnt mit dem Funnel-Audit', titelJe.loom[0], 'Funnel-Audit – Verfahren für die Loom-Analyse')
check('Gespräch: Setting & Closing zuerst', titelJe.gespraech[0], 'Outbound-Skripte 2 – Setting & Closing')
check('Angebot: Aufbau vor Wertanalyse', titelJe.angebot, ['Angebots-Dokument – Aufbau & Regeln', 'Angebot & Wertanalyse – Eigentümer-Funnel'])
check('Positionierung landet im Hintergrund, nicht im Angebot', titelJe.hintergrund[0], 'Positionierung & Angebot – Eigentümer-Funnel')
check('Zwei Loom-Warteschlangen bleiben unterscheidbar', titelJe.loom.filter((t) => t.startsWith('Loom-Warteschlange')), ['Loom-Warteschlange vom 19.08.', 'Loom-Warteschlange vom 26.08.'])
check('Inhaltsverzeichnis „Vertrieb & Outreach" fehlt', ordnung.some((g) => g.eintraege.some((e) => e.titel === 'Vertrieb & Outreach')), false)
const gesamt = ordnung.reduce((n, g) => n + g.eintraege.length, 0)
check('Keine Datei geht verloren (außer dem Inhaltsverzeichnis)', gesamt, vault.length + skripte.length - 1)
check(
  'Unbekannte Datei landet sichtbar im Hintergrund',
  ordneRessourcen({ vault: [{ name: 'Neue Notiz.md', path: 'x/Neue Notiz.md', kind: 'md', mtime: '' }], skripte: [] }).map((g) => g.schritt.id),
  ['hintergrund'],
)

for (const g of ordnung) console.log(`${g.schritt.titel}: ${g.eintraege.map((e) => e.titel).join(' · ')}`)
console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail) process.exit(1)
