/**
 * Uriel-Werkzeuge — die Fähigkeiten, die Uriel im Cockpit hat.
 * Definitionen (Anthropic-Schema) hier; die Ausführung (Executor) liegt im
 * Client (UrielDock), weil UI-Tools React-State treiben und Daten-Tools die
 * eingeloggte Supabase-Session brauchen. Beide Seiten leben im Repo und werden
 * zusammen reviewt.
 */
import { METRIC_FIELDS, METRIK_LABEL } from './metrikFelder'

export interface UrielTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/** „li_anfragen = Vernetzungsanfragen (LinkedIn) · …" — die Feldkarte für Uriel. */
const FELD_KARTE = METRIC_FIELDS.map((f) => `${f} = ${METRIK_LABEL[f]}`).join(' · ')

export const URIEL_TOOLS: UrielTool[] = [
  // ---- Gedächtnis (Client persistiert lokal) ----
  {
    name: 'remember',
    description:
      'Merkt dir dauerhaft einen kurzen Fakt über Kevin oder seine Arbeit (Präferenz, Kontext, Entscheidung, Person), damit du ihn in KÜNFTIGEN Gesprächen kennst. Nutze das still im Hintergrund, wenn etwas Merkenswertes fällt — kündige es nicht groß an. Ein Fakt = ein knapper Satz.',
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Der zu merkende Fakt, ein knapper Satz.' },
      },
      required: ['fact'],
    },
  },
  // ---- Tracking schreiben (Client führt aus, über useDailyMetrics) ----
  {
    name: 'log_metric',
    description:
      'Trägt Kevins Tages-Tracking in daily_metrics ein — das einzige Werkzeug, das Zahlen SCHREIBT. ' +
      'Nutze es, wenn Kevin sagt, was er getan hat („trag 30 Vernetzungsanfragen ein", „ich hab heute 5 Looms gemacht", ' +
      '„gestern 12 Follow-ups"). Der Wert wird ADDIERT, nicht überschrieben — steht für den Tag schon etwas, kommt es dazu. ' +
      'Zum Korrigieren einen negativen Wert schicken. Nur EIN Feld je Aufruf; für mehrere Angaben mehrfach aufrufen. ' +
      `Feldkarte: ${FELD_KARTE}. ` +
      'Umsatz kann dieses Werkzeug NICHT — der wird gesetzt, nicht addiert; dafür auf /tracking verweisen. ' +
      'Nenne in deiner Antwort den zurückgegebenen Tages- und Wochenstand, damit Kevin einen Vertipper sofort sieht.',
    input_schema: {
      type: 'object',
      properties: {
        feld: {
          type: 'string',
          enum: [...METRIC_FIELDS],
          description: 'Das Metrik-Feld. Nur exakt diese Namen — nichts erfinden oder ableiten.',
        },
        wert: {
          type: 'integer',
          description: 'Wie viel dazukommt. Negativ zum Korrigieren (z.B. -5). 0 ist nicht erlaubt.',
        },
        datum: {
          type: 'string',
          description:
            'Optional, Format YYYY-MM-DD. Ohne Angabe: heute. Nur Vergangenheit bis 45 Tage zurück; die Zukunft lehnt das Werkzeug ab.',
        },
      },
      required: ['feld', 'wert'],
    },
  },
  // ---- UI-Steuerung (Client führt aus) ----
  {
    name: 'set_graph_view',
    description:
      'Schaltet den Nebula-Graphen im Cockpit auf eine der Ansichten. "leads" = Vertriebs-Pipelines (Kaltakquise/Loom/Sales), "rings" = Betriebssystem-Ringe (Skills/Memory/Routines/Apps), "nebula" = Galaxie-Cluster nach Bereich, "workflows" = Agenten und ihre letzten Läufe (Status-Farben). Nutze das, wenn Kevin eine Ansicht sehen will.',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['rings', 'nebula', 'leads', 'workflows'] },
      },
      required: ['view'],
    },
  },
  {
    name: 'search_graph',
    description:
      'Durchsucht/hebt Knoten im Nebula-Graphen hervor (Nicht-Treffer werden gedimmt). Leerer String hebt die Suche auf. Gut für "zeig mir X im Graphen".',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'navigate',
    description:
      'Navigiert zu einem Cockpit-Bereich. cockpit=Startseite/Graph, sales=Kontakte/Pipeline/Bibliothek (crm=Alias, gleiches Ziel), projekte=Kundenprojekte, ads=Ad-Review, content=Social/Content, agenten=Agenten-Hub, email=E-Mail, tracking=KPI-Tracking.',
    input_schema: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          enum: ['cockpit', 'sales', 'crm', 'projekte', 'ads', 'content', 'agenten', 'email', 'tracking'],
        },
      },
      required: ['area'],
    },
  },
  {
    name: 'open_contact',
    description:
      'Öffnet einen konkreten CRM-Kontakt (per contact_id, wie von search_contacts geliefert). Führt zur Kontakt-Detailansicht.',
    input_schema: {
      type: 'object',
      properties: { contact_id: { type: 'string' } },
      required: ['contact_id'],
    },
  },
  // ---- Daten lesen (Client führt aus, aus geladenem Cockpit-State) ----
  {
    name: 'get_today_kpis',
    description:
      'Kevins Vertriebs-Zahlen von HEUTE (bis jetzt) für die aktive Brand: Anfragen, ' +
      'Nachrichten, Looms, vereinbarte Termine, Abschlüsse, Umsatz. ' +
      'HERKUNFT, die in die Auskunft gehoert: das sind AUSSCHLIESSLICH von Hand gebuchte ' +
      'Zahlen (Zaehl-Modus, QuickTrack, log_metric) — nicht von LinkedIn gemessen. Eine 0 ' +
      'heisst „noch nicht gebucht", nicht zwingend „nicht gemacht". Was tatsaechlich im ' +
      'Postfach passiert ist, steht in get_linkedin_postfach.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_week_vitals',
    description:
      'Die Wochen-Vitals der aktiven Brand: je Kategorie (Anfragen, Nachrichten, Looms, ' +
      'Termine, Abschlüsse) der Stand gegen das Wochenziel. Die Woche laeuft MONTAG bis ' +
      'SONNTAG der laufenden Kalenderwoche — nicht „die letzten 7 Tage". Am Montagmorgen ' +
      'stehen die Zahlen deshalb naturgemaess bei fast null; das ist kein Einbruch. ' +
      'Gleiche Herkunft wie get_today_kpis: von Hand gebucht, nicht gemessen.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_month_revenue',
    description:
      'Der Monatsumsatz der aktiven Brand gegen das Monatsziel, dazu der bis heute faellige ' +
      'Soll-Stand. Der Soll-Verlauf ist BACK-LOADED, nicht linear: er steigt zum Monatsende ' +
      'hin staerker, weil Akquise dem Ergebnis nachlaeuft. Aus „Soll bis heute" darf also ' +
      'nicht Monatsziel geteilt durch Tage gerechnet werden.',
    input_schema: { type: 'object', properties: {} },
  },
  // ---- LinkedIn-Postfach (11.08.) ----
  /**
   * Uriel behauptete auf die Frage „wie viele haben angenommen" sinngemaess,
   * das Cockpit kenne nur handgetippte Zahlen. Das stimmte nicht: der
   * Voyager-Sync spiegelt Kevins Postfach nach `linkedin_threads`. Uriel hatte
   * nur kein Werkzeug dafuer — also erzaehlte es etwas ueber die App, statt
   * nachzusehen. Ab hier kann es nachsehen.
   *
   * Was es damit NICHT kann, steht ausdruecklich in der Beschreibung: wer eine
   * offene Vernetzungsanfrage angenommen hat, steht in keinem gespiegelten
   * Datensatz. Ein Werkzeug, das seine eigene Grenze nicht nennt, laedt zum
   * naechsten selbstbewussten Irrtum ein.
   */
  /**
   * Die Eimer-Namen standen hier zuerst OHNE Bedeutung — nur als Liste. Uriel
   * hat sich daraufhin ausgedacht, was `faellig` heisst, und Kevin gesagt, das
   * seien 61 Leute ohne Erstnachricht. Das Gegenteil ist der Fall: in `faellig`
   * liegt nur, wo Kevin BEREITS geschrieben hat und das Follow-up ueberfaellig
   * ist. Haette er danach gehandelt, waeren 61 zweite „erste" Nachrichten
   * rausgegangen. Seitdem steht jede Bedeutung ausgeschrieben da.
   */
  {
    name: 'get_linkedin_postfach',
    description:
      'Der Stand von Kevins LinkedIn-Postfach, wie ihn der Voyager-Sync gespiegelt hat. ' +
      'Ein Thread existiert hier NUR, wenn schon eine Unterhaltung laeuft. Die Eimer ' +
      'bedeuten genau das hier — nicht raten, sondern diese Bedeutung benutzen: ' +
      '`faellig` = Kevin hat zuletzt geschrieben und das Follow-up ist ueberfaellig ' +
      '(3/7/14 Tage je Stufe); `du_bist_dran` = der Lead hat geantwortet, Kevin ist am Zug; ' +
      '`wartet` = Kevin hat geschrieben, die Frist laeuft noch; ' +
      '(einen Eimer `verwaist` gibt es seit dem 14.08.2026 NICHT mehr — was ueber ' +
      '30 Tage liegt, steht als aeltester Eintrag in `faellig`, nichts wird aussortiert); ' +
      '`abschluss` = drei Follow-ups durch, Break-up faellig; ' +
      '`pruefen` = Sync unsicher, wer zuletzt schrieb; `ruht` = archiviert, gewonnen, ' +
      'verloren oder schlafen gelegt. ' +
      'In ALLEN diesen Eimern hat Kevin bereits geschrieben — ausser `du_bist_dran` und ' +
      '`pruefen`. Keiner davon beantwortet „an wen muss ich noch eine Erstnachricht ' +
      'schicken": dafuer gibt es das Feld `erstnachrichten_offen` in der Antwort. ' +
      'Auch dessen Herkunft gehoert in die Auskunft: das sind die VORBEREITETEN ' +
      'Erstnachrichten aus dem letzten Lauf des linkedin-leads-Skills, die noch nicht ' +
      'verschickt sind. Wer erst nach diesem Lauf angenommen hat oder als Off-ICP ' +
      'aussortiert wurde, steht NICHT darin — die Zahl ist der Arbeitsvorrat mit fertigem ' +
      'Text, nicht die Gesamtzahl aller Angenommenen. ' +
      'Und wer eine OFFENE Vernetzungsanfrage angenommen hat, steht hier gar nicht — ' +
      'das spiegelt der Sync nicht.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_linkedin',
    description:
      'Sucht eine Person im gespiegelten LinkedIn-Postfach (Name oder Firma) und gibt ' +
      'zurueck, in welchem Eimer sie liegt, wer zuletzt geschrieben hat, wann das war, ' +
      'ob ein Entwurf bereitliegt und ob sie einen Stern hat. Damit laesst sich „habe ich ' +
      'dem schon geschrieben" beantworten, ohne dass Kevin nachsieht.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name oder Firma' } },
      required: ['query'],
    },
  },
  // ---- Call-Nachbereitung schreiben (08.10.) ----
  /**
   * Kevin will nach einem Sales-Call nur noch einmal frei reinsprechen. Das
   * Diktat ist unsortiert und voller Transkriptionsfehler — die Sortierarbeit
   * gehört Uriel, nicht Kevin. Deshalb ist die Beschreibung so genau: jedes
   * Feld sagt, was hineingehört, damit nichts Erzähltes verloren geht und
   * nichts Erfundenes hineinkommt.
   */
  {
    name: 'call_nachbereiten',
    description:
      'Trägt die Nachbereitung eines Sales-Calls in einen CRM-Kontakt ein — nutze das IMMER, wenn Kevin ' +
      'nach einem Gespräch erzählt, wie es lief („hatte gerade den Call mit …", „Gesprächsnotizen zu …"). ' +
      'Ablauf: erst search_contacts mit Name ODER Firma (bei keinem Treffer auch den anderen Begriff probieren); ' +
      'gibt es den Kontakt nicht, `neuer_kontakt` mitschicken (dann wird er angelegt). EIN Aufruf pro Gespräch, alles auf einmal. ' +
      'Regeln: (1) Jede Einzelinformation aus dem Diktat landet in `punkte` — vollständig, nichts weglassen, ' +
      'in Kevins Sinn, aber sauber formuliert; Transkriptionsfehler sinngemäß korrigieren. (2) Nichts erfinden: ' +
      'ein Feld, zu dem Kevin nichts gesagt hat, bleibt leer. (3) Was Kevin über SICH sagt (Pitch, Routine, ' +
      'Skript) gehört in `learnings`, nicht in die Kunden-Felder. (4) Relative Daten („nächste Woche Donnerstag") ' +
      'in ein echtes Datum umrechnen — das heutige Datum steht im Kontext. ' +
      'Bestehende Texte am Kontakt werden nicht überschrieben, sondern mit Datum ergänzt. ' +
      'Antworte danach kurz: was eingetragen ist, der nächste Termin, und was offen bleibt.',
    input_schema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'id aus search_contacts. Leer lassen, wenn neuer_kontakt gesetzt ist.' },
        neuer_kontakt: {
          type: 'object',
          description: 'Nur wenn search_contacts nichts fand. Ansprechpartner als name, Firma separat.',
          properties: {
            name: { type: 'string' },
            firma: { type: 'string' },
            email: { type: 'string' },
            telefon: { type: 'string' },
            position: { type: 'string' },
          },
          required: ['name'],
        },
        art: {
          type: 'string',
          enum: ['setting', 'closing', 'gespraech'],
          description:
            'setting = Erstgespräch/Qualifizierung; closing = Gespräch mit Entscheidung über das Angebot; ' +
            'gespraech = alles dazwischen (Konzeptgespräch, Präsentation, Demo).',
        },
        zusammenfassung: { type: 'string', description: '2–3 Sätze: wie lief es, wo steht der Lead.' },
        punkte: {
          type: 'array',
          items: { type: 'string' },
          description: 'ALLE Einzelinformationen aus dem Diktat, je ein Punkt: Anforderungen, Fragen, Fakten, Personen.',
        },
        bedarf: { type: 'string', description: 'Was der Lead braucht/will (Anforderungen).' },
        aktuelle_situation: { type: 'string', description: 'Ist-Zustand: aktuelle Tools, Abläufe, Team.' },
        hauptproblem: { type: 'string' },
        einwaende: { type: 'string', description: 'Bedenken, kritische Fragen, Vorbehalte.' },
        timeline: { type: 'string', description: 'Zeitrahmen beim Lead (Übergabe, Ausstieg, Deadline).' },
        budget: { type: 'string' },
        naechste_schritte: { type: 'string', description: 'Was als Nächstes passiert, mit Datum.' },
        entscheider_name: { type: 'string', description: 'Wer (mit)entscheidet, falls genannt.' },
        ist_entscheider: { type: 'boolean', description: 'Entscheidet der Gesprächspartner allein? Nur setzen, wenn klar.' },
        abschluss_wahrscheinlichkeit: { type: 'integer', description: '0–100, nur wenn Kevin eine Einschätzung gibt oder sie klar ableitbar ist.' },
        potenzial_betrag: { type: 'integer', description: 'Auftragswert in EUR, nur wenn genannt.' },
        pipeline_stage: {
          type: 'string',
          enum: ['first_contact', 'conversation', 'follow_up', 'proposal', 'deal', 'paused'],
          description: 'Nur setzen, wenn sich die Stufe durch das Gespräch ändert.',
        },
        naechster_kontakt_datum: { type: 'string', description: 'YYYY-MM-DD oder ISO mit Uhrzeit.' },
        naechster_kontakt_typ: { type: 'string', enum: ['call', 'meeting', 'email', 'other'] },
        learnings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Was Kevin über seinen eigenen Pitch/Ablauf sagt — für ihn, nicht für den Kunden.',
        },
        ergebnis: { type: 'string', description: 'Nur bei closing: gewonnen, verloren oder offen.' },
      },
      required: ['art', 'zusammenfassung', 'punkte'],
    },
  },
  {
    name: 'search_contacts',
    description:
      'Sucht CRM-Kontakte der aktiven Brand nach Name oder Firma. Liefert id, Name, Firma, ' +
      'Pipeline-Stufe und geschaetztes Potenzial. Nutze die id danach fuer open_contact. ' +
      'Die Stufen bedeuten genau das hier — nicht raten: ' +
      '`first_contact` = angeschrieben, noch kein Gespraech; ' +
      '`conversation` = im Gespraech; ' +
      '`follow_up` = wartet auf Nachfassen; ' +
      '`proposal` = Angebot draussen; ' +
      '`deal` = gewonnen; ' +
      '`paused` = zurueckgestellt. ' +
      'Das Potenzial ist eine SCHAETZUNG von Kevin, kein vereinbarter Betrag.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
]
