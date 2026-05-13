# Foundation Merge Plan

## Ziel

`Building` und `Discovery` werden zu einem einzigen Bereich `Foundation` zusammengeführt.
Der Merge ist rein funktional-strukturell in der App-Schicht; bestehende Discovery-Agent/Feed-Mechanik bleibt erhalten.

---

## Was Building heute enthält

Quelle: `app/src/pages/building/BuildingMode.tsx`

- **Foundation-Header + Controls**
  - Titel `Foundation`
  - `Template`-Button (`BrandTemplatePicker`)
  - `Copy for Claude` (`ContextExportButton`)
  - `BuildingHealthCard`
- **Foundation-Sektionen (Collapsible)**
  - `Business Model — Wer · Was · Wie · Für wen · Womit`
  - `ICPs — Zielgruppen`
  - `Positioning & Tone`
  - `Word Bank — Ja / Nein`
- **Library-Bereich**
  - `Assets`
  - `SOPs — Prozesse & Vorlagen`
- **Daten/Hooks**
  - `useBusinessModel`, `useICPs`, `usePositioning`, `useWordBank`
  - `useAssets`, `useSOPs`

---

## Was Discovery heute enthält

Quelle: `app/src/pages/discovery/DiscoveryMode.tsx`

- **Discovery Foundation**
  - Eingabefelder/Editor für `market`, `competitors`, `niche`
  - „Analyse ausführen“ via Edge Function `discovery-agent`
  - Übernahme-Buttons zurück in Foundation-Daten (`ICPs`, `Word Bank`, `Positioning`, `Tone`)
  - „Aus Building übernehmen“ (`syncFromBuilding`)
- **Discovery Feed**
  - Feed-Liste + Interval-Settings
  - Refresh via Edge Function `discovery-feed-refresh`
  - Persistiert `last_feed_generated_at`
- **Daten/Hooks**
  - `useDiscoveryFoundation`, `useDiscoveryFeed`, `useDiscoverySettings`
  - plus Bridge auf Foundation-Hooks (`useBusinessModel`, `useICPs`, `usePositioning`, `useWordBank`)

---

## Betroffene Daten-Tabellen und Überlappung

Basierend auf `docs/data-model.md` + aktueller Hook-Nutzung:

- **Building/Fundament intern**
  - `foundation_positioning`
  - `foundation_icps`
  - `foundation_word_bank`
  - `assets`
  - `sops`
- **Discovery extern**
  - `discovery_foundation` (market / competitors / niche + analysis payload)
  - `discovery_feed_items`
  - `discovery_settings`

### Überlappung / Vereinfachung

- Es gibt **inhaltliche Überlappung in der UI**, aber **keine Tabellen-Kollision**.
- Discovery schreibt Analyse-Ergebnisse und kann sie in Building/Fundament-Tabellen übernehmen.
- Das ist für den Merge gut: Foundation kann beide Datenstränge in einer Seite zusammenführen, ohne DB-Schema-Migration.

---

## Discovery Edge Functions

Aus `DiscoveryMode.tsx`:

- `discovery-agent`
  - Trigger für Marktanalyse (Perplexity + Claude)
  - Schreibt in `discovery_foundation` und ggf. `discovery_feed_items`
- `discovery-feed-refresh`
  - Holt aktuelle Signale in `discovery_feed_items`

Status für Merge:

- **Bleiben unverändert nutzbar**.
- Foundation ruft dieselben Functions auf; nur UI-Ort und Route ändern sich.

---

## Aktuelle Routen und nötige Redirects

Quelle: `app/src/App.tsx`

- aktuell:
  - `/brand/:slug/building` → `BuildingMode`
  - `/brand/:slug/discovery` → `DiscoveryMode`
  - `/brand/:slug/dashboard` → Redirect auf `/brand/:slug`
- Ziel:
  - `/brand/:slug/foundation` → `FoundationMode`
  - `/brand/:slug/building` → Redirect auf `/brand/:slug/foundation`
  - `/brand/:slug/discovery` → Redirect auf `/brand/:slug/foundation`

Zusätzlich:

- Keyboard-Navigation in `OwnerWorkspaceShell` (`g b`) muss auf `foundation` zeigen.
- Sidebar-Navigation (`BrandWorkspaceSidebar`) bekommt ein einziges Item `Foundation` statt `Building` + `Discovery`.

---

## Welt/Regionen (Scope für Phase 4)

Quelle: `app/src/three/regions/regionGeometry.ts` + `app/src/three/PlanetSurface.tsx`

- aktuell 5 Regionen: `building`, `discovery`, `promo`, `sales`, `intelligence`
- Ziel 4 Regionen: `foundation`, `promo`, `sales`, `intelligence`
- Struktur-Merge:
  - `BuildingPyramid` + `DiscoveryTower` → `FoundationStructure`
  - Health + Discovery-Signal-Pulsing in einer kombinierten Struktur

---

## Offene Risiken vor Umsetzung

- `BrandNavSection` / Route-Parser müssen sauber auf `foundation` erweitert werden, sonst Sidebar-Active-State falsch.
- Foundation-Health wird bisher nur aus Building-Daten berechnet; Discovery-Felder müssen explizit ergänzt werden.
- Context Export darf beim Merge keine Discovery-Infos verlieren.

---

## Done

- `FoundationMode` als neuer zentraler Modus unter `/brand/:slug/foundation` angelegt.
- Building- und Discovery-Inhalte in neun Sektionen zusammengeführt.
- `foundationHealth` um Discovery-Felder (`market`, `competitors`, `niche`) erweitert.
- Router + Sidebar + Shortcut-/Navigation auf Foundation umgestellt.
- Alte Routen `/building` und `/discovery` per Redirect auf `/foundation` umgestellt.
- Welt-Regionen auf vier Regionen reduziert und `FoundationStructure` eingeführt.
- Alte Dateien (`BuildingMode`, `DiscoveryMode`, `BuildingPyramid`, `DiscoveryTower`) entfernt.
- Doku in `docs/system.md`, `docs/data-model.md`, `docs/world-roadmap.md` aktualisiert.
