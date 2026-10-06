import type { Posten } from './prioritaet'

/** Projektordner, in dem die Prüf-Session aufgeht (Stimme + Regeln liegen im Repo). */
const SESSION_ORDNER = '/Users/kevin/Kevin OS/02 Projekte/uriel'

/** Die Claude-App schneidet bei 14.336 Zeichen ab — knapp darunter bleiben. */
const MAX_PROMPT = 13_000

const ART: Record<string, string> = {
  erstnachricht: 'Erstnachricht (der Lead hat noch nichts von uns gehört)',
  antwort: 'Antwort auf eine Nachricht des Leads',
  followup: 'Follow-up an einen Lead, der nicht mehr geantwortet hat',
}

/**
 * Der Auftrag an die Session: alles, was Kevin sonst per Screenshot
 * reingeschickt hat, damit man über die Nachricht sprechen kann, bevor sie rausgeht.
 */
export function neuPruefenPrompt(p: Posten): string {
  const kopf = [
    `Neuprüfung einer Outreach-Nachricht aus Uriel.`,
    ``,
    `Lead: ${p.name}${p.firma ? `, ${p.firma}` : ''}`,
    `Art: ${ART[p.spur] ?? p.spur}`,
    p.profil ? `LinkedIn: ${p.profil}` : null,
    p.website && p.website !== p.profil ? `Website: ${p.website}` : null,
  ].filter((z): z is string => z !== null)

  const teile = [kopf.join('\n')]
  if (p.entwurf) {
    teile.push(`Nachricht des Leads / Kontext:\n${p.text}`)
    teile.push(`Vorbereiteter Entwurf (der geprüft werden soll):\n${p.entwurf.text}`)
  } else {
    teile.push(`Vorbereitete Nachricht (soll geprüft werden):\n${p.text}`)
  }
  teile.push(
    [
      `Lies erst den Skill herrmann-outreach und ${SESSION_ORDNER}/runner/regeln/stimme/herrmann-outreach.md, ` +
        `such dann im Vault nach dem Lead und seinem bisherigen Verlauf.`,
      `Ich sage dir gleich, was an der Nachricht nicht passt. Schlag bis dahin nichts Neues vor, ` +
        `und schick nichts ab. Wenn wir uns einig sind, gibst du mir den fertigen Text zum Kopieren.`,
    ].join('\n'),
  )
  const voll = teile.join('\n\n')
  return voll.length <= MAX_PROMPT ? voll : `${voll.slice(0, MAX_PROMPT)}\n[gekürzt]`
}

/** Deep-Link, der in der Claude-App eine neue Code-Session mit diesem Auftrag öffnet. */
export function neuPruefenLink(p: Posten): string {
  const q = new URLSearchParams({ q: neuPruefenPrompt(p), folder: SESSION_ORDNER })
  return `claude://code/new?${q.toString().replace(/\+/g, '%20')}`
}
