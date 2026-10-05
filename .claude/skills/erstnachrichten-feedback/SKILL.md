---
name: erstnachrichten-feedback
description: Arbeitet Kevins gesammeltes Feedback zu den LinkedIn-Erstnachrichten aus der Uriel-Stufe „Prüfen" ab — holt alle Feedbacks, schreibt die Texte neu, leitet daraus Regeln für Schreiber und Prüfer ab und schreibt alles zurück, sodass die Texte direkt bei den Erstnachrichten stehen. Use wenn Kevin über den Knopf „Feedbacks an Claude" kommt oder sagt "arbeite das Feedback ab", "Feedback zu den Erstnachrichten", "lern aus meinem Feedback". NICHT für einzelne Antworten/Follow-ups (dafür herrmann-outreach).
---

# Erstnachrichten-Feedback abarbeiten

Kevin hat in Uriel unter „Prüfen" zu einzelnen Texten Feedback geschrieben.
Ziel dieser Session: **jeder Text mit Feedback ist danach korrigiert und steht
versandfertig bei den Erstnachrichten**, und **die Regeln sind so nachgeschärft,
dass derselbe Fehler beim nächsten Lauf des Mini nicht mehr passiert.**

Arbeitsordner: `/Users/kevin/Kevin OS/02 Projekte/uriel`. Nichts wird verschickt,
das macht Kevin selbst.

## 1. Holen

```bash
npx tsx scripts/erstnachrichten-feedback.ts holen > /tmp/feedback.json
```

Je Text: Name, Firma, Website, Prüf-Hinweis, `alter_text`, `feedback` und
`screenshots` (lokale Bildpfade). **Jeden Screenshot mit Read ansehen** — oft
steht darin, was Kevin meint, und der Text im Feedback ist nur ein Stichwort.
`anzahl: 0` → Kevin sagen, dass nichts ansteht, und aufhören.

## 2. Lesen, bevor du schreibst

- `runner/regeln/erstnachrichten/schreiben.md` (Aufbauten, erlaubte Schlusssätze, Verbote)
- `runner/regeln/erstnachrichten/pruefen.md` (Prüffälle = Kevins frühere Urteile)
- `runner/regeln/stimme/herrmann-outreach.md` (Kevins Stimme)

Dazu den Skill `herrmann-outreach`. Wo das Feedback eine Tatsache betrifft
(„ist Geschäftsführer", „die Seite ist neu", „falsche Firma"), die Website mit
WebFetch selbst ansehen. **Kevins Angabe gilt als gesichert** und schlägt
Recherche und Impressum.

## 3. Texte neu schreiben

Je Text eine neue Fassung: Kevins Feedback umsetzen, alles andere aus dem
alten Text übernehmen, wo es stimmt. Regeln aus `schreiben.md` gelten weiter
(Länge, Schlusssätze, keine Geviertstriche, Du/Sie wie im alten Text).
Sagt das Feedback „raus", „passt nicht", „nicht anschreiben" → `aussortieren`.

**Zeig Kevin die neuen Texte gesammelt** (Name, Feedback in einem Halbsatz,
neuer Text) und warte auf sein Okay oder seine Korrekturen. Erst danach
zurückschreiben.

## 4. Lernen: Regeln nachschärfen

Such das **Muster** hinter den Feedbacks, nicht 25 Einzelregeln. Für jedes
Muster, das wieder vorkommen kann:

- Fehler beim Schreiben → Regel in `schreiben.md` an der passenden Stelle
  (meist §4 Befund, §6 Aufbauten, §8 Verboten), mit Kevins Satz wörtlich und
  Datum, so wie die bestehenden Einträge.
- Fehler, den der Prüfer hätte fangen müssen → Prüffall in `pruefen.md` unter
  „Prüffälle — so hat Kevin selbst geurteilt".
- Reine Einzelfälle (falsche Website, ein Tippfehler) → keine Regel.

Kevin die Regeländerungen in zwei, drei Sätzen nennen. Dann sichern, **bevor**
zurückgeschrieben wird. Die neue Regel-Fassung muss beim Mini angekommen sein,
sonst hält er die korrigierten Texte für veraltet und überschreibt sie:

```bash
git add runner/regeln && git commit -m "rules: lessons from Kevin's first-message feedback" && git push
```

Nur `runner/regeln` committen, keine fremden offenen Änderungen mitnehmen.

**Folge der Regeländerung, Kevin vorher sagen:** Alle anderen offenen Texte ohne
Feedback gelten danach als veraltet und werden in der nächsten Runde des Mini
mit den neuen Regeln neu geschrieben.

## 5. Zurückschreiben

```json
[{ "id": "…", "nachricht": "Moin …" }, { "id": "…", "aussortieren": true }]
```

```bash
npx tsx scripts/erstnachrichten-feedback.ts setzen /tmp/feedback-neu.json
```

Das Skript bricht ab, solange `runner/regeln` ungesichert ist. Das ist Absicht.

## 6. Abschluss an Kevin

Ein Satz Ergebnis („12 Texte korrigiert, 2 aussortiert, stehen bei den
Erstnachrichten"), dann die gelernten Regeln als kurze Liste. Keine
Werkzeug-Namen.
