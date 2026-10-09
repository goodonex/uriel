# Fallkatalog Outreach: die nächsten 100 verbrannten Leads, vorher abgefangen

Stand 09.10.2026. Grundlage: 467 gesendete Erstnachrichten (320 seit der neuen
Recherche am 16.09.), 79 Antworten, 595 Gesprächsverläufe, 146 offene Entwürfe,
86 von Kevin beanstandete Fälle aus Regeln und Commits, Messung der
Website-Suche an 30 echten „keine Seite"-Texten.

## Was die Zahlen sagen

- Seit 16.09. kamen 52 Antworten. **16 davon (31 %) haben wir mit unserem
  eigenen Text verloren**, 19 waren ein Ja.
- „Keine Website gefunden": 32 Mal geschickt, **0 Ja**. In 12 von rund 30
  Fällen gab es die Seite, in 4 davon hatte Uriel sie sogar schon gespeichert.
- Bewertungstool als Mangel: seit der Regel vom 23.09. noch **8 Mal**
  verschickt. Prompt-Regeln allein halten nicht.
- Nachfassen nach klarem Nein: 13 Gespräche, darunter beide genervten
  Antworten. Die Konterfrage nach einer Absage: 4 gesendet, 0 Antworten.
- „Nochmal angeschaut + neuer Mangel" im Nachfassen: 82 gesendet, **0 Ja**.
  Kurzer Bump ohne neue Kritik: 98 gesendet, 3 Ja.
- Was Ja bringt: starke Seite loben plus geprüfte Anzeigen-Lücke (5 von 5
  Antworten Ja), Frage an Verwaltungen ohne Kritik (21 % Antworten),
  Ankauf-Winkel bei Projektentwicklern, Sie-Form spiegeln.

## Die Grundregel seit heute

**Ein Fehler, der zweimal vorkommt, wird Code, nicht Prompt.** Drei feste
Stellen entscheiden jetzt, nicht das Schreib-Modell:

1. **Lage** (`runner/regeln/lage.mjs`): großer Player ja/nein, mit Beleg; dazu
   der Kanal je Ansatz (Analyse, Frage, Telefonat).
2. **Ansatz** (`ansatzFuer`): welcher Aufbau, bevor ein Wort geschrieben ist.
3. **Satz-Wache** (`runner/regeln/textWache.mjs`): prüft jeden Text aus jedem
   Pfad (Erstnachricht, Antwort, Nachfassen, Anfragen an dich, Texte nach
   Kevins Feedback). Ein Treffer wird neu geschrieben oder kommt nicht in
   Kevins Liste.

Alles davon prüft `npx tsx scripts/verify-fallkatalog.ts`: 890 Prüfungen über
720 durchgespielte Kombinationen (3 Zielgruppen × Größe × 10 Website-Zustände ×
Anzeigen × Verbund × Rolle, also 240 je Zielgruppe) plus echte verschickte
Sätze, Vorlagen, Absagen und Domains.

## Analyse, Frage oder Telefonat

| Lage | Kanal | Aufbau |
|---|---|---|
| Inhaber, Seite da, wir bauen sichtbar besser | Analyse | A, P |
| Seite stark | Frage (Anzeigen/Tempo) | S, T |
| Seite frisch neu oder im Umbau | Frage | R, R2 (neu) |
| Großer Player (Milliarden, KVG, ab 100 Leute, ab 8 Standorte) | Frage per Sie | G (neu) |
| Hausverwaltung | Frage (neue Objekte?) | H |
| Franchise/Dachmarke | Frage (eigene Marke?) | V |
| Angestellt mit Firma nebenher | Frage (Hauptfokus) | N |
| Keine Seite nach vollständiger Suche | Frage („Wo finde ich euch?") | D, F |
| Suche gescheitert | gar kein Text, nächster Lauf sucht neu | – |
| Nur Portal, bewusst | Telefonat | D-Portal |
| Lead hat geantwortet und Pain genannt | Telefonat | Stimme, Regel 19 |

Legende Status: **Code** = vom Code entschieden und getestet · **Regel** = nur
im Prompt · **offen** = noch nicht gebaut.

## Makler (inhabergeführt)

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| M1 | Seite existiert, Firmenname nur mit „Immobilien" googelbar (ALCEMA) | Stufe 1 hat sie, Google zum bloßen Namen leer | Stufe-1-Fund ist erster Kandidat, Suche auch „Firma Immobilien" | Code |
| M2 | Domain mit Umlaut-Variante, Schweiz (gunes-immobilien.ch) | „ü" im Namen, CH-Profil | Suche DE/CH/AT, Domain-Varianten, Impressum-Abgleich | Code |
| M3 | „& Partner" in der Domain (beros-partner.ch) | „&" im Firmennamen | Varianten mit Bindestrich | Code |
| M4 | Kürzel-Domain (dk-homes.ch, ekablum.immo) | mehrteiliger Name, .immo | Varianten, .immo/.eu, Google-Treffer mit Nachname + Immobilienbezug | Code |
| M5 | Firma steht nur in der Headline („CEO FinValue & Offmarkly") | Erfahrung leer | Firma aus Headline und Stufe 1 in die Suche | Code |
| M6 | Erfahrung nicht lesbar, deshalb gar keine Google-Liste | „Selbstständig" ohne Firma | Person + Immobilien wird immer gesucht | Code |
| M7 | Google-Abfrage bricht ab (DataForSEO-Fehler mit HTTP 200) | Fehlercode ≠ 20000 | Wiederholen; zählt als „Suche unvollständig" | Code |
| M8 | Suche unvollständig, trotzdem „keine Seite"-Text | – | kein Text, Lead bleibt im Vorrat | Code |
| M9 | Gleichnamiger fremder Makler (Röper Lippstadt) | Impressum nennt andere Person | Code-Fund ohne Personenname im Impressum gilt nicht als sicher, dann D-Frage statt Befund | Code |
| M10 | Namensgleiche Fremdfirma ohne Immobilien (Teppichreinigung edguenes.at) | kein Immobilienbezug in Titel/Impressum | verworfen | Code |
| M11 | Seite passt laut Befund nicht zur Person, zweiter Kandidat wäre richtig | `passt_zur_person` = false | nächster Kandidat statt „keine Seite" | Code |
| M12 | Cloudflare blockt die Code-Probe (Ariana) | HTTP 403 | Domain = Firmenname → Kandidat für echten Chrome | Code |
| M13 | Text behauptet „keine Seite" in neuer Formulierung („gibt es noch nicht", „online noch kein Auftritt", „nur Registereinträge gefunden") | – | Satz-Wache, 11 neue Muster aus verschickten Texten | Code |
| M14 | Suchbericht statt Befund („landet bei einem anderen Röper") | – | Satz-Wache | Code |
| M15 | Domain da, aber abgelaufen/„Coming soon" | Stufe 1 bestätigt, lädt nicht | Aufbau C, nicht D | Code |
| M16 | Tote Domain nur geraten (vonbuelow-cie.de) | nicht belegt | D-Frage statt „lädt nicht" | Code |
| M17 | Bewertungstool als Mangel („nur Formular", „erst per Mail", „kein Sofort-Wert", „Rückmeldung nach 24 Stunden") | – | nie; Satz-Wache | Code |
| M18 | Google-Bewertungen (Sterne) mit Bewertungstool verwechselt | „21 Bewertungen mit fünf Sternen" | erlaubt, Wache unterscheidet | Code |
| M19 | Schwache Seite, Text kritisiert Formular/Knopf/Menüpunkt | Stufe schwach, nicht zeitgemäß | die Seite ist der Elefant; Detailkritik blockiert | Code |
| M20 | Seite frisch neu, Text kritisiert sie | „neue Website", Launch dieses Jahr | Aufbau R: Glückwunsch + „Ist auch schon eingeplant, wie über die neue Seite Eigentümer reinkommen?" | Code (Erkennung durch Befund-Modell) |
| M21 | Seite kündigt Umbau an | „wird überarbeitet" | Aufbau R2: „Wann geht die neue Seite online?" | Code (Erkennung durch Befund-Modell) |
| M22 | Starke Seite bekommt Analyse | Wow „nein", Stufe stark | S oder T, nie Analyse | Code |
| M23 | „Ihr schaltet keine Anzeigen", obwohl Google unbekannt | Anzeigen-Feld unbekannt | Satz-Wache, nur bei beiden „nein" | Code |
| M24 | „Ihr schaltet schon Anzeigen" ohne Beleg | keins „ja" | Satz-Wache | Code |
| M25 | Kleinkram (Tippfehler, Copyright, Ladezeit, Cookie-Banner, Meta-Tags) | – | Satz-Wache | Code |
| M26 | Kundenstimmen „fake/fiktiv" genannt | – | Satz-Wache | Code |
| M27 | Abwertende Bilder („schräg", „Vorlage, in die niemand eingezogen ist", „lieblos") | – | Satz-Wache; Beobachtung statt Urteil | Code |
| M28 | Geviertstrich im Text | – | Satz-Wache | Code |
| M29 | „Noch ganz frisch, oder?" an eine Firma, die über ein Jahr alt ist | Station „seit 2025" | frisch nur in den letzten 12 Monaten | Code |
| M30 | Bewusstes Markenzeichen als Mangel (Comic-Figur TREND, Minimal-Seite per Gesellschafterbeschluss) | prominent, konsistent, alt | höchstens anerkennen, als Frage | Regel |
| M31 | Funktion übersehen, die per Script lädt (Sofort-PDF, Sprengnetter-Widget) | Bewertungs-Widget im Quelltext | nur Screenshot-Belegtes; Bewertung ist ohnehin kein Aufhänger | Code (Wache) + Regel |
| M32 | Inhaber steht nicht auf der eigenen Teamseite | LinkedIn-CEO, Teamseite ohne ihn | Elefant im Raum ansprechen, ohne Analyse | Regel |
| M33 | Zweite Generation, Impressum nennt den Vater | gleicher Nachname, anderer Vorname | Rapport + Hauptfokus-Frage | Regel |
| M34 | Rolle unklar, Text bietet Analyse | Impressum nennt andere Person | Angestellte: GF-Suche statt Analyse | Code (bestehend) |
| M35 | Mehrere Leute derselben Firma | gleiche Domain | alle bekommen eine Nachricht | Regel |

## Hausverwaltungen

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| H1 | Verwaltung bekommt Analyse in der Erstnachricht | Geschäftsmodell Verwaltung | Aufbau H, Frage nach Kapazität | Code |
| H2 | Verwaltung bekommt Analyse im Nachfassen (Piechullik, Mlakar, Winkler) | Lage im Antwort-Pfad | Kanal Frage, Analyse-Satz blockiert | Code |
| H3 | „Eigentümer-Anfragen" oder „Verkaufsmandate" an Verwaltung | – | Satz-Wache | Code |
| H4 | Große Verwaltung (ab 100 Leute) | Mitarbeiterzahl auf der Seite | Aufbau G, Sie, Verwaltungsfrage | Code |
| H5 | Verwaltung mit Kundenlogin oben (Casavi), kein Weg für neue Kunden | Login im Hero | Rapport + H-Frage, keine Kritik | Regel |
| H6 | Verwaltung „seid ihr ausgelastet" → „ja, voll" | Antwort | freundlich abschließen, kein Pitch | Regel |
| H7 | Verwaltung mit Makler-Abteilung | „Verkauf" im Menü | H zuerst, Makler-Hebel erst nach Antwort | Regel |
| H8 | Verwaltung ohne Seite | – | H ohne Domain-Satz, nie „keine Seite" | Code (Wache) |
| H9 | Verwaltung antwortet auf H mit Pain | „suchen Objekte" | Telefonat anbieten | Regel |
| H10 | Verwaltung kündigt „Bei Bedarf melden wir uns" | weiches Nein | eine Antwort, danach kein Nachfassen | Code |

## Projektentwickler und Bauträger

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| P1 | Entwickler bekommt Makler-Sprech („Eigentümer-Anfragen") | Geschäftsmodell Entwickler | Käufer-Winkel; Satz-Wache | Code |
| P2 | Entwickler mit eigenem Vertrieb | Vertriebsfirma auf der Seite | Ankauf-Winkel (Grundstück/MFH anbieten) | Regel |
| P3 | Großer Entwickler (30 Mrd. Transaktionsvolumen, Anzenberger) | Milliarden im Text | Aufbau G, Sie, Deal-Frage | Code |
| P4 | GU mit 178 Einheiten (Mächler) | „Einheiten", „GU" | Pain-Frage auf seiner Ebene, keine Rechtfertigung | Regel (Stimme 28) |
| P5 | Projekt-GmbH, Projekt noch in Planung (Kronenbräu) | nur Gemeinde-Seite | nicht anschreiben oder Frage zum Projekt | Regel |
| P6 | Bauträger mit Projektseite je Objekt | eigene Domains je Projekt | Hauptdomain suchen, Projektdomain zählt nicht als „keine Seite" | Regel |
| P7 | Entwickler mit Holding-Struktur, kein Endkunden-Vertrieb | „Holding", „Investment" | Investor-Sperre prüft, Inhaber mit Makler-Herkunft bleibt | Code (bestehend) |
| P8 | „Analyse nur als Blick von außen" | Lead relativiert | Telefonat statt Video | Regel |
| P9 | Bestandshalter mit eigener Entwicklung | „kaufen und entwickeln" | Ankauf-Winkel; bisher übersprungen | offen |
| P10 | Entwickler mit schwacher Seite und 500-Mio.-Projektvolumen | Volumen ≥ 500 Mio. | Aufbau G | Code |
| P11 | Entwickler mit 80-Mio.-Volumen | darunter | normaler P-Ansatz | Code |
| P12 | Neubau-Vertrieb für Bauträger (kein Eigentümer-Geschäft) | „Vertrieb für Bauträger" | Käufer-Winkel oder nicht anschreiben | Regel |

## Franchise und Dachmarken

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| V1 | Partner bekommt Kritik an der Zentralseite | Evernest, RE/MAX, E&V, von Poll | Aufbau V: eigene Marke? | Code |
| V2 | Dachmarke nicht in der Liste (Kensington, catasto) | Franchise-Beleg in Erfahrung | V nur mit Beleg; Liste erweitern | offen |
| V3 | GF der eigenen Firma mit Dachmarke im Namen (Blumhagen) | Impressum nennt ihn | Rückfall auf normalen Ansatz | Code (bestehend) |
| V4 | Gründer der Dachmarke selbst | „CEO & Founder" | kein V | Code (bestehend) |
| V5 | Partner ohne eigene Seite, baut Personenmarke (Simmen) | „Marke als Person" | Telefonat ohne Behauptung „keine Seite" | Code (Wache) + Regel |
| V6 | Partner mit Nebenfirma | eigene Firma in den Stationen | Nebenfirma in den Rapport | Regel |
| V7 | Zentrale-Seite und Google-Anzeigen der Zentrale | Franchise | nie Anzeigen der Zentrale dem Partner zuschreiben | Regel |
| V8 | Früherer Franchise-Partner | „bis 2022" | kein V | Code (bestehend) |

## Große Player (Konzern, institutionell)

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| G1 | Milliarden-Volumen auf der Seite | „30 Milliarden" | Aufbau G | Code |
| G2 | ab 500 Mio. mit Volumen-Wort | „650 Mio. € Transaktionsvolumen" | Aufbau G | Code |
| G3 | KVG, börsennotiert, Pensionskasse | Selbstbeschreibung | Aufbau G | Code |
| G4 | ab 100 Mitarbeitende | Zahl auf Seite | Aufbau G | Code |
| G5 | ab 8 Standorte | Zahl auf Seite | Aufbau G | Code |
| G6 | Konzern-Urteil + AG/SE | Recherche | Aufbau G | Code |
| G7 | Kleiner Schweizer Makler als AG | AG ohne Konzern | normal | Code |
| G8 | Makler „vermittelt an institutionelle Investoren" | Kundenbeschreibung | normal | Code |
| G9 | Postfach-, Formular-, info@-Kritik an großem Haus | – | Satz-Wache | Code |
| G10 | Analyse an großes Haus | – | Satz-Wache | Code |
| G11 | Großer Player im Nachfassen, Volumen nur in Kevins alter Nachricht | Verlauf | Lage liest den Verlauf mit | Code |
| G12 | Du an großes Haus | – | Aufbau G per Sie | Code |
| G13 | Konzern-Mitarbeiter (nicht GF) | angestellt | GF-Suche, nicht anschreiben | Code (bestehend) |

## Sonderfälle

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| X1 | Maklerpool/Plattform (Offmarkly) | „Pool", „Plattform" | Frage nach eigenem Bedarf, keine Analyse | offen |
| X2 | Gewerbe-/Zinshausmakler | „Gewerbe", „Zinshaus" | heute als „sonstiges" übersprungen; Kevin entscheidet | offen |
| X3 | Luxus/Off-Market, Seite bewusst leer | „Diskretion", „off-market" | Frage, ob bewusst | Regel |
| X4 | Investor, der kauft | „kaufe Mehrfamilienhäuser" | nicht anschreiben, nie „Leads" | Code (bestehend) |
| X5 | Rentner / Firma in Liquidation (Rabensdorf) | Handelsregister | nicht anschreiben | Regel |
| X6 | Schweiz: „ß", „Moin" | .ch, CH-Ort | „ss"; Anrede-Frage | offen |
| X7 | Titel und lange Historie (Dr., Freiherr, seit 1976) | Profil | Sie erwägen | offen |
| X8 | Profil nur mit Firmennamen | kein Personenname | „Moin," ohne Namen | Regel |
| X9 | Website liefert Zertifikatsfehler | Browser | Aufbau C, Zertifikat-Variante | Regel |
| X10 | Sprachnachricht/Bild als Antwort | Platzhalter | Kevin hört selbst rein | Code (bestehend) |
| X11 | Lead korrigiert uns („nicht meine Website") | Antwort | richtige Seite selbst suchen, nicht zurückfragen | Regel |

## Antworten und Nachfassen

| # | Fall | Signal | Richtig | Status |
|---|---|---|---|---|
| A1 | Hartes Nein („Damit sollten wir es gut sein lassen") | Wortlaut | kein Entwurf mehr | Code |
| A2 | Weiches Nein („kein Bedarf", „bei Bedarf melde ich mich", „sehr zufrieden") | Wortlaut | eine Antwort, danach kein Nachfassen | Code |
| A3 | „Seite wird gerade überarbeitet" | Wortlaut | kein Nein; später fragen, wann sie live ist | Code |
| A4 | Lead siezt, Entwurf duzt | „Sehr geehrter Herr Herrmann", „Ihnen" | Satz-Wache | Code |
| A5 | Nachfassen bietet Analyse an großem Haus/Verwaltung/Verbund/starker Seite | Lage | Kanal Frage, Satz blockiert | Code |
| A6 | Nachfassen wiederholt einen verworfenen Satz | Wache-Fund vom Vorlauf | Thread kommt mit `wache_hinweis` wieder | Code |
| A7 | „Keine Seite" im Nachfassen | – | Satz-Wache (galt schon seit 08.10.) | Code |
| A8 | Kapital unterstellen („wenn das Kapital wieder frei ist", Kremkau) | – | Satz-Wache | Code |
| A9 | Interesse gezeigt, nur Frage zurück (Lauria „Tell me") | Interesse | Befund + Analyse-Angebot bzw. Telefonat | Regel |
| A10 | Pain genannt, Entwurf rechnet ihm seine Lage vor (Heinen) | lange Antwort | eine Pain-Frage | Regel (Stimme 19) |
| A11 | Website für Lead irrelevant (Minnert) | „Seite irrelevant" | „Was ist denn momentan relevant für dich?" | Regel (Stimme 20) |
| A12 | Nach eigenem Fehler sofort wieder Akquise (Günes, Beros) | Lead korrigiert | Halbsatz „stimmt", dann Frage, kein Pitch | Regel |
| A13 | Unterwürfiges Nachfassen („wie versprochen") | – | Frame halten | Regel (Stimme 24) |
| A14 | Ja zur Analyse, Entwurf kündigt nur an | Stern, Loom offen | kein Entwurf, Loom ist die Antwort | Code (bestehend) |
| A15 | Termin-Wunsch mit Stern | Termin-Wörter | Antwort, nicht Loom-Liste | Code (bestehend) |
| A16 | Ironie wörtlich genommen (Anger „14 Tage 😉") | Emoji | mitspielen, nicht belehren | Regel |
| A17 | Alte Erstnachricht ohne Befund, nie beantwortet | Januar-Vorlage | einmal die ordentliche Erstnachricht | Regel (Stimme 25) |
| A18 | „Nochmal angeschaut + neuer Mangel" | – | 0 von 82 Ja; siehe Entscheidung unten | offen |
| A19 | Konterfrage nach weichem Nein („das höre ich selten …") | – | 0 von 4 Antworten; siehe Entscheidung unten | offen |
| A20 | Prüf-Hinweis stand dran, Text ging trotzdem raus (5 Brandfälle) | PRÜFEN-Hinweis | erst klären, dann senden | offen (Kevin) |

## Offen und bewusst nicht gebaut

- **LinkedIn-Unternehmensseite und Kontaktinfo als Website-Quelle.** Braucht
  den eingeloggten Chrome auf dem Mini; der nächste Schritt, falls trotz der
  neuen Suche noch Seiten fehlen.
- **Kensington, catasto und weitere Dachmarken** in die Verbund-Liste.
- **Gewerbemakler, Maklerpools, Bestandshalter mit Entwicklung** haben noch
  keinen eigenen Ansatz und fallen heute als „sonstiges" heraus.
- **Sie in der Erstnachricht** nur bei großen Playern. Für Titel und alte
  Häuser bleibt Du.
- **Zwei bestehende Prüfungen in `verify-entscheider.ts` sind rot** (Konzern
  mit Marketing-Rolle), schon vor dem 09.10.

## Kontrolle am 16.10.2026

Auf dem Mini im Runner-Log zählen:
- `[website-spur]` Zeilen mit „SUCHE UNVOLLSTÄNDIG" und „Code fand" (wie oft
  rettet die neue Suche eine Seite, wie oft bleibt ein Lead liegen)
- `[satz-wache]` Funde je Art (welche Wache greift, und bleiben Texte
  dauerhaft hängen)
- Antworten auf Aufbau G und R

Bleibt ein Lead über drei Läufe mit unvollständiger Suche liegen, braucht es
einen Zähler und eine Kandidatenliste an Kevin.
