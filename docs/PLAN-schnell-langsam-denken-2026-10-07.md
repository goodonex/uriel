# Schnell erkunden, langsam prüfen — Plan für alle Programme (07.10.2026)

Auslöser: Kevins Einfall (Kahneman, "Schnelles Denken, Langsames Denken") plus ein Instagram-Post über ein angebliches Stanford-Paper. Die Zahlen im Post sind nicht verifiziert (MATH500 29,6 % ist für heutige Modelle unplausibel), das Prinzip trägt trotzdem.

## Prinzip

1. **Breit erkunden** (System 1): mehrere Varianten, kreativ, billig.
2. **Streng prüfen** (System 2): ein unabhängiger Prüfer, der nicht selbst geschrieben hat, Befund je Schritt/Satz mit Beleg.
3. **Chirurgisch reparieren**: nur den beanstandeten Teil neu machen.
4. **Mehrheit bei Grenzfällen**: drei Prüf-Läufe, Uneinigkeit geht an Kevin.

Das Modell zu wechseln ist Stufe zwei. Den Hauptgewinn bringt die Rollentrennung.

## Stand 07.10.2026

| Programm | Stand |
|---|---|
| Uriel | Gebaut: C (Mehrheit beim Aussortieren, `pruefeEntwuerfe` in `runner/linkedin/erstnachrichtenAblauf.mjs`), A+B (Prüfer nennt beanstandete Sätze, Schreiber ändert nur diese). D (mehrere Entwürfe) bewusst nicht, erst nach Test. |
| Jophiel | Gebaut: Korrekturläufe dürfen nur die beanstandeten Stellen ändern (`NUR_BEANSTANDETES` in `server/pipeline.mjs`). Prüfung, mechanische Vorprüfung und Nachbesserung gab es schon. |
| Gabriel | Gebaut: `server/gegenleser.mjs` liest jeden Entwurf Satz für Satz gegen Idee und Regelwerk, beanstandete Sätze werden einmal gezielt neu geschrieben. Tests in `test/gegenleser.test.mjs`. |
| Makler-Tool (Staffel Büro) | Nichts zu bauen: kein Modell im Programm (Exposé, Mails, Termine sind feste Vorlagen). Einhängen, sobald dort KI-Text entsteht. |
| Laplace | Bewusst nicht angefasst: Eingriff in die Entscheidungslogik würde die Papierhandel-Messung entwerten. Erst nach den drei Monaten oder als getrennter Vergleichsstrang. |

Nichts davon ist committet, nichts live getestet mit echten Modell-Läufen (nur Syntax und vorhandene Tests).
