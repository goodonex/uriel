/**
 * Wache für den Auftrag-vom-Laptop-Agenten (10.09.2026).
 *
 * Dieser Agent ist der einzige, dessen Prompt und Arbeitsordner von außen
 * kommen — aus einer Zeile in `runner_jobs`, die Kevin vom Laptop oder vom
 * Handy schreibt. Er läuft auf dem Mini, nachts, ohne dass jemand zusieht, und
 * darf Dateien schreiben. Die Prüfung des Arbeitsordners ist damit keine
 * Formalie: Fällt sie aus, schreibt ein Tippfehler im Pfad irgendwohin.
 *
 * Start: npx tsx scripts/verify-auftrag-agent.ts
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const runner = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
const skript = readFileSync(join(wurzel, 'scripts/an-den-mini.mjs'), 'utf8')

/* ── Der Agent existiert und ist richtig eingestellt ───────────────────── */
{
  check('der Agent `auftrag` steht im Katalog', /id: 'auftrag'/.test(runner))
  check(
    'er läuft auf Opus — der Auftrag ist unbekannt, dort ist ein kleines Modell die teuerste Ersparnis',
    /id: 'auftrag'[\s\S]{0,900}?modell: 'claude-opus-5'/.test(runner),
  )
  check('er trägt einen Geld-Deckel', /id: 'auftrag'[\s\S]{0,900}?budget: \d+/.test(runner))
  check('startRun reicht den Input an agentConfig durch', /agentConfig\(agent, input\)/.test(runner))
  check('ohne Auftragstext startet nichts', /Auftrag ohne Text/.test(runner))
}

/* ── Die Pfadprüfung, der eigentliche Grund für diese Datei ────────────── */
{
  check('es gibt erlaubte Wurzeln', /const AUFTRAG_WURZELN = \[/.test(runner))
  check('der Vault gehört dazu', /AUFTRAG_WURZELN = \[VAULT/.test(runner))
  check(
    'geprüft wird mit Trenner — sonst ginge „Kevin OS-geheim" als „Kevin OS" durch',
    /startsWith\(w \+ sep\)/.test(runner),
    'Ein reines startsWith(w) wäre die Lücke.',
  )
  check('ein fremder Ordner wird abgelehnt', /außerhalb der erlaubten Wurzeln/.test(runner))
  check('ein nicht existierender Ordner wird abgelehnt', /Arbeitsordner gibt es nicht/.test(runner))

  // Dieselbe Regel muss schon im Absende-Skript greifen, damit ein Fehlgriff
  // gar nicht erst als Auftrag in der Tabelle landet.
  check('das Absende-Skript prüft dieselben Wurzeln', /startsWith\(w \+ sep\)/.test(skript))

  // Die Logik selbst, an den Fällen die zählen.
  const WURZELN = [resolve(join(homedir(), 'Second Brain')), resolve(join(homedir(), 'Kevin OS'))]
  const erlaubt = (p: string) => {
    const g = resolve(p)
    return WURZELN.some((w) => g === w || g.startsWith(w + '/'))
  }
  const faelle: [string, boolean][] = [
    [join(homedir(), 'Second Brain'), true],
    [join(homedir(), 'Second Brain', '03 Bereiche'), true],
    [join(homedir(), 'Kevin OS', '02 Projekte', 'uriel'), true],
    ['/tmp', false],
    ['/', false],
    [homedir(), false],
    [`${join(homedir(), 'Kevin OS')}-geheim`, false], // der Trenner-Fall
    [join(homedir(), 'Second Brain', '..', 'Downloads'), false], // Ausbruch über ..
  ]
  for (const [pfad, erwartet] of faelle) {
    check(`${erwartet ? 'erlaubt' : 'abgelehnt'}: ${pfad}`, erlaubt(pfad) === erwartet)
  }
}

/* ── Der Agent darf schreiben, aber nicht alles ────────────────────────── */
{
  const block = runner.match(/if \(a\.id === 'auftrag'\)[\s\S]{0,2600}/)?.[0] ?? ''
  check('die Werkzeuge stehen explizit am Aufruf', /--allowedTools/.test(block))
  check('kein Blanket-Bypass der Rechte', !/bypassPermissions|--dangerously/.test(block), block.slice(0, 200))
  check('Bash nur mit benannten Befehlen, keine Wildcard', !/'Bash'|Bash\(\*\)|Bash:\*/.test(block))
  for (const verboten of ['rm', 'curl', 'ssh', 'sudo', 'chmod']) {
    check(`Bash(${verboten}) ist nicht erlaubt`, !new RegExp(`Bash\\(${verboten}:`).test(block))
  }
}

/* ── Das Absende-Skript ────────────────────────────────────────────────── */
{
  check('der Auftragstext kommt über stdin, nicht als Argument', /readFileSync\(0, 'utf8'\)/.test(skript))
  check('ein zu dünner Auftrag wird abgelehnt', /auftrag\.length < 120/.test(skript))
  check('es meldet, wenn der Mini kein Lebenszeichen gibt', /Lebenszeichen/.test(skript))
  check('es gibt einen Prüfmodus, der nichts schreibt', /--pruefen/.test(skript) && /nurPruefen/.test(skript))
  check(
    'der Repo-Pfad wird entkodiert — „Kevin OS" enthält ein Leerzeichen',
    /fileURLToPath/.test(skript),
    'Mit .pathname käme %20 zurück und die .env wäre nicht lesbar.',
  )
  check('es schreibt einen agent_run-Auftrag', /kind: 'agent_run'/.test(skript) && /agent: 'auftrag'/.test(skript))
}

/* ── Neuen Code selbst holen ───────────────────────────────────────────── */
{
  /**
   * Der Anlass: Kevin hatte auf dem Mini gepullt, und der Auftrag scheiterte
   * trotzdem mit „Unbekannter Agent" — der laufende Prozess hatte den alten
   * Code im Speicher. Was hier zurückrutscht, kostet keinen Fehler, sondern
   * einen Gang zum Mini.
   */
  const block = runner.match(/const CODE_CHECK_MS[\s\S]{0,3000}/)?.[0] ?? ''
  check('es gibt einen Code-Check', /async function codeCheckTick/.test(runner))
  check('er ist abschaltbar', /CODE_AUTOUPDATE/.test(runner))
  check('er läuft im Intervall', /setInterval\(\(\) => void codeCheckTick/.test(runner))
  check(
    'aber nicht sofort beim Start — das wäre eine Neustart-Schleife',
    /setTimeout\(\(\) => void codeCheckTick\(\), 60_000\)/.test(runner),
  )

  check(
    'kein Update, solange ein Agent läuft — sonst stirbt er mitten in der Arbeit',
    /codeCheckLaeuft \|\| running\.size > 0/.test(block),
  )
  check(
    'nach dem fetch wird erneut auf laufende Agenten geprüft',
    (block.match(/running\.size > 0/g) ?? []).length >= 2,
    'Zwischen fetch und pull kann ein Lauf gestartet sein.',
  )
  check(
    'eigene Änderungen auf dem Mini werden nicht überfahren',
    /status', '--porcelain/.test(block) && /eigene Änderungen/.test(block),
  )
  check('gepullt wird nur als Fast-Forward', /'pull', '--ff-only'/.test(block))
  check('nach dem Pull beendet sich der Prozess — launchd startet ihn neu', /process\.exit\(0\)/.test(block))
  check('der launchd-Agent hält ihn am Leben', /KeepAlive/.test(readFileSync(join(wurzel, 'scripts/install-runner-autostart.sh'), 'utf8')))
}

console.log(`\nverify-auftrag-agent: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
