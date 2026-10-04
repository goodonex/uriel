-- 0097 — Ereignis-Typ `antwort_gesendet` (04.10.2026).
--
-- Kevins Befund: „Ich habe heute schon 2-4 Antworten rausgeschickt, in
-- ‚Heute raus' steht aber, es sei nichts passiert."
--
-- Der Haken auf einer Antwort ("Du bist dran" -> Erledigt) hat bisher nur den
-- Thread umgeschrieben (`markDonePatch`) und kein Lead-Ereignis angelegt.
-- `arbeitsmodusTracking.ereignisTypFuer('antwort')` lieferte absichtlich null,
-- weil es keinen Typ fuer „Kevin hat geantwortet" gab und `antwort_erhalten`
-- das GEGENTEIL meint (der Lead hat geschrieben). Jetzt gibt es ihn.
--
-- Bewusst KEIN Kanal im Funnel: `funnelRaten` und `leadStation` kennen den Typ
-- nicht und zaehlen ihn nirgends mit — er taucht nur im Tagesjournal und in der
-- Lead-Akte auf.
--
-- Die Liste wird VOLLSTAENDIG neu gesetzt (ein `check` ersetzt den alten
-- komplett) — Stand 0090 plus der eine Typ hier.

alter table lead_ereignisse
  drop constraint if exists lead_ereignisse_typ_check;

alter table lead_ereignisse
  add constraint lead_ereignisse_typ_check check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    -- Neu (0097): Kevin hat dem Lead geantwortet.
    'antwort_gesendet',
    'loom_zugesagt', 'loom_abgelehnt', 'loom_gesendet', 'loom_angesehen',
    'inmail', 'email', 'postkarte', 'anruf',
    'instagram', 'pdf',
    'uebersprungen',
    'angebot_gesendet', 'angebot_signiert',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  ));
