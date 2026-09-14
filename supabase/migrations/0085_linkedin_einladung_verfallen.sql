-- 0085: Eine dritte Antwort auf „was ist aus der Einladung geworden?" (14.09.2026)
--
-- **Der Anlass.** Kevin sah seit Wochen denselben Widerspruch auf dem
-- Homescreen: „1 Kontakt gilt als Einladung offen, obwohl mit ihm geschrieben
-- wird." Dazu der Handgriff „Netzwerk-Sync nachziehen" — der nichts behob, denn
-- der Sync war gelaufen. Kevin am 14.09.: *„Was ist jetzt meine Aufgabe? Wenn es
-- da nichts zu tun gibt, dann nimm das Todo raus oder sag mir, was ich zu tun
-- hab."*
--
-- **Was wirklich vorlag.** Quentin Schäfer wurde im März eingeladen, hat nie
-- angenommen — und LinkedIn zieht Einladungen nach etwa sechs Monaten selbst
-- zurück. Seit dem 18.08. stand er in keiner der beiden Listen mehr: weder
-- offene Einladung noch Kontakt. 0070 kannte für diesen Zustand keinen Wert
-- (`check (status in ('offen','angenommen'))`), also blieb er auf 'offen'
-- stehen und widersprach sich mit dem Thread, der von ihm existierte.
--
-- Er ist kein Einzelfall: Am 14.09. betraf das **79** Einträge — 48 zuletzt im
-- August gesehen, 31 im September. Der Widerspruchs-Wächter meldete davon genau
-- einen, weil nur zu diesem ein Gesprächsverlauf existiert.
--
-- **Warum ein Status und nicht nur ein Filter.** Die Auswertung rechnet bereits
-- richtig: `inmailKandidaten` verlangt zusätzlich zum Status einen frischen
-- `zuletzt_gesehen_at` und lässt die 79 damit ohnehin draußen (1.105 statt
-- 1.184). Die Zahlen ändern sich durch diese Migration also nicht. Was sich
-- ändert, ist die Lesbarkeit: Ein Zustand, den man nur aus zwei Feldern
-- zusammenrechnen kann, wird von jeder neuen Abfrage aufs Neue falsch gelesen —
-- und ein Wächter, der ihn meldet, klingt wie ein Fehler, obwohl er keiner ist.
--
-- 'verfallen' heißt ausdrücklich NICHT 'abgelehnt': Ob die Person abgelehnt hat
-- oder LinkedIn die Einladung hat verjähren lassen, steht nirgends geschrieben.
-- Für den Vertrieb ist beides dasselbe — der zweite Anlauf läuft über eine neue
-- Einladung oder eine InMail.

alter table linkedin_netzwerk
  drop constraint if exists linkedin_netzwerk_status_check;

alter table linkedin_netzwerk
  add constraint linkedin_netzwerk_status_check
  check (status in ('offen', 'angenommen', 'verfallen'));

-- Wann der Eintrag als verfallen erkannt wurde. Bewusst getrennt von
-- `zuletzt_gesehen_at`: Das eine sagt „zuletzt auf der Liste gesehen", das
-- andere „von einem vollständigen Lauf als nicht mehr vorhanden bestätigt".
alter table linkedin_netzwerk
  add column if not exists verfallen_at timestamptz;

comment on column linkedin_netzwerk.verfallen_at is
  'Wann ein vollstaendiger Einladungs-Lauf den Eintrag nicht mehr auf der Liste fand (Status verfallen).';
