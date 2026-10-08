---
name: nachrichten-feedback
description: Arbeitet Kevins Rückmeldungen aus Uriel ab — alles, was er an einer Nachricht mit „Claude sagen, was nicht passt" abgegeben hat (Prüfen, Erstnachrichten, Antworten, Follow-ups, Looms, Anfragen an dich). Holt alle, schreibt die Texte neu, schärft daraus die Regeln nach und schreibt alles zurück, sodass die Nachrichten mit neuem Text wieder in ihrer Liste stehen. Use wenn Kevin sagt "zieh dir die neuen Sachen aus Uriel", "hol dir das Feedback aus Uriel", "arbeite das Feedback ab", "was liegt bei Claude", "bearbeite den Rest", oder über den Knopf „Jetzt abarbeiten" kommt. NICHT für eine einzelne Nachricht, die Kevin direkt im Chat einfügt (dafür herrmann-outreach).
---

# Rückmeldungen aus Uriel abarbeiten

Kevin hat in Uriel an einzelnen Nachrichten geschrieben, was nicht passt. Diese
Nachrichten stehen gerade **nicht** in ihrer Liste und zählen vorerst als
erledigt („bei Claude"). Ziel dieser Session: **jede davon hat danach einen
korrigierten Text und steht wieder in ihrer Liste**, und **die Regeln sind so
nachgeschärft, dass derselbe Fehler beim nächsten Lauf des Mini nicht mehr
passiert.** Danach sieht Kevin z. B. wieder „32 von 36" statt „36 von 36".

Arbeitsordner: `/Users/kevin/Kevin OS/02 Projekte/uriel`. Nichts wird verschickt,
das macht Kevin selbst.

## 1. Holen

```bash
npx tsx scripts/nachrichten-feedback.ts holen > /tmp/feedback.json
```

Je Nachricht: `schluessel`, `art` (erstnachricht · thread · anfrage), `stufe`
(pruefen · erstnachrichten · antworten · followups · looms · anfragen), Name,
Firma, Links, `aktueller_text`, bei Threads der `verlauf`, Kevins `feedback` und
`screenshots` (lokale Bildpfade). **Jeden Screenshot mit Read ansehen** — oft
steht darin, was Kevin meint, und der Text ist nur ein Stichwort.
`anzahl: 0` → Kevin sagen, dass nichts ansteht, und aufhören.

## 2. Lesen, bevor du schreibst

- `runner/regeln/stimme/herrmann-outreach.md` (Kevins Stimme, gilt für alles)
- Erstnachrichten und Prüfen: zusätzlich `runner/regeln/erstnachrichten/schreiben.md`
  und `pruefen.md` (Prüffälle = Kevins frühere Urteile)
- Antworten, Follow-ups, Looms: den Skill `herrmann-outreach` und den `verlauf` —
  der Text antwortet auf die letzte Nachricht des Leads, nicht auf eine ältere

Wo das Feedback eine Tatsache betrifft („ist Geschäftsführer", „die Seite ist
neu", „falsche Firma"), die Website selbst ansehen. **Kevins Angabe gilt als
gesichert** und schlägt Recherche und Impressum.

## 3. Texte neu schreiben

Je Nachricht eine neue Fassung: Kevins Feedback umsetzen, alles andere aus dem
alten Text übernehmen, wo es stimmt. Länge, Schlusssätze, keine Geviertstriche,
Du/Sie wie im alten Text.

- Feedback „raus", „passt nicht", „nicht anschreiben" → bei Erstnachricht und
  Anfrage `aussortieren`.
- Feedback ist eine Frage an dich oder eine Notiz ohne Änderungswunsch am Text →
  beantworten bzw. umsetzen, Text mit `zurueck` unverändert zurückgeben.
- Feedback betrifft die Oberfläche von Uriel statt den Text → im Abschluss als
  eigenen Punkt nennen; der Text geht mit `zurueck` oder neu zurück.

**Nicht auf Kevins Okay warten.** Die Texte stehen danach wieder in ihrer Liste
und sind dort vor dem Versand noch einmal sichtbar.

**Nie Kevin etwas nachsehen lassen.** Steht im Feedback „google selbst" oder
„wieso googelst du nicht", suchst du jetzt selbst und schreibst den Text auf
Basis dessen, was du findest.

## 4. Lernen: Regeln nachschärfen

Such das **Muster** hinter den Rückmeldungen, nicht eine Regel je Nachricht.
Für jedes Muster, das wieder vorkommen kann:

- Fehler beim Schreiben einer Erstnachricht → Regel in `schreiben.md` an der
  passenden Stelle, mit Kevins Satz wörtlich und Datum, wie die bestehenden.
- Fehler, den der Prüfer hätte fangen müssen → Prüffall in `pruefen.md` unter
  „Prüffälle — so hat Kevin selbst geurteilt".
- Fehler in Antworten, Follow-ups oder Looms, oder in Kevins Ton allgemein →
  `runner/regeln/stimme/herrmann-outreach.md`.
- Reine Einzelfälle (falsche Website, ein Tippfehler) → keine Regel.

Dann sichern, **bevor** zurückgeschrieben wird — sonst hält der Mini die
korrigierten Texte für veraltet und überschreibt sie:

```bash
git add runner/regeln && git commit -m "rules: lessons from Kevin's message feedback" && git push
```

Nur `runner/regeln` committen, keine fremden offenen Änderungen mitnehmen.
Hat sich an den Erstnachrichten-Regeln etwas geändert, gelten alle anderen
offenen Erstnachrichten danach als veraltet und werden beim nächsten Lauf des
Mini neu geschrieben — das Kevin im Abschluss in einem Satz sagen.

## 5. Zurückschreiben

```json
[
  { "schluessel": "thread:…", "nachricht": "Moin …" },
  { "schluessel": "erstnachricht:…", "aussortieren": true },
  { "schluessel": "anfrage:…", "zurueck": true }
]
```

```bash
npx tsx scripts/nachrichten-feedback.ts setzen /tmp/feedback-neu.json
```

Das Skript bricht ab, solange `runner/regeln` ungesichert ist. Das ist Absicht.
Jede Nachricht aus `holen` muss in der Datei stehen, sonst bleibt sie bei Claude
und fehlt Kevin weiter in der Liste.

## 6. Abschluss an Kevin

Ein Satz Ergebnis („9 Nachrichten neu geschrieben, 1 aussortiert, stehen wieder
in ihren Listen"), dann je Nachricht eine Zeile (Name, sein Feedback in einem
Halbsatz, was sich geändert hat) und die gelernten Regeln als kurze Liste.
Keine Werkzeug-Namen.
