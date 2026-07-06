# Rebuild-Notes — Cockpit-Umbau

Protokoll je Phase gemäß [REBUILD-PLAN.md](REBUILD-PLAN.md).
Format: Was getan · Was entschieden · Was offen.

---

## Phase 0 — Branch, Cleanup, Baseline (2026-07-06)

**Getan:**
- Branch `cockpit-rebuild` von `main` erstellt.
- Duplikat-Ordner gelöscht: `app/src/three/regions 2`, `app/src/modules/intelligence 2`, `app/src/modules/promo 2` (Finder-Kopien, nicht importiert).
- Vorgefundene uncommittete Deploy-Configs von main mitgenommen: `app/vercel.json` (neu), `.vercel` in `.gitignore`, `engines.node: 22.x` in package.json.

**Entschieden:**
- Deploy-Configs werden als eigener Housekeeping-Commit übernommen (trivial, passt zur bestehenden Vercel-Deploy-Story aus HANDOFF.md).

**Offen:**
- —

---

## Phase 1 — Design-Tokens + Shell (2026-07-06)

**Getan:**
- `src/styles/cockpit.css`: Tokens (§4) gescoped unter `.ck-root` — kollidiert nicht mit alten Glas-Tokens. Utility-Klassen: ck-panel, ck-label, ck-dot (on/warn/pulse), ck-nav-item, ck-btn, ck-input, ck-select, ck-table.
- `src/cockpit/`: CockpitShell (fixed, volle Viewport, eigenes Scrolling), StatusBar (Wortmarke, CORE/SUPABASE/RUNNER-Status, Brand-Switcher, Uhr), NavRail (4 Bereiche + Universe-Rücklink bis Phase 6), 4 Platzhalter-Seiten.
- `src/cockpit/lib/activeBrand.tsx`: Brand-Kontext auf useBrands-Basis, localStorage-persistiert (Default: herrmann).
- `src/cockpit/lib/useRunnerStatus.ts`: pollt 127.0.0.1:4711/status (15s, 2.5s-Timeout) — zeigt ehrlich OFFLINE bis Phase 5.
- App.tsx: Cockpit-Routen unter OwnerWorkspaceShell (auth-geschützt), Canvas via `isCockpitPath()` auf Cockpit-Pfaden ausgeblendet.
- index.html: JetBrains Mono um 600/700 erweitert.

**Entschieden:**
- KEIN @fontsource-Paket nötig — JetBrains Mono war schon via Google Fonts geladen (nur Weights ergänzt). Eine Dependency gespart.
- Tokens gescoped statt global, damit alt+neu bis Phase 6 konfliktfrei koexistieren.

**Offen:**
- Visuelle Verifizierung der Shell im eingeloggten Zustand (Auth-Gate; Kevin loggt sich im Preview ein). Build grün, Routing verifiziert, Konsole sauber.

---

## Phase 2 — Cockpit-Home mit Daten-Graph (2026-07-06)

**Getan:**
- `d3-force` + `@types/d3-force` installiert (einzige neue Runtime-Dependency).
- `graph/ForceGraph.tsx`: Canvas-2D-Force-Graph (kein WebGL). Physik: manyBody, link, center, collide. Hub (aktive Brand) in der Mitte fixiert. Hover-Ring + Label, Klick-Hit-Testing, Puls-Ring für laufende Runs, ResizeObserver.
- `lib/graphData.ts`: Datenmodell (hub/deal/run/note) + Mock-Graph in exakt der Form, die Phase 3/5 liefern. Farbcodierung: Deals Grün, Runs helles Akzent-Grün, Notizen Blaugrau + Legende.
- `lib/goals.ts`: WEEK_TARGETS (150/25/5/2), Juli-Soll-Kurve (3k/11k/20k/30k), August-Kurve (50k back-loaded), CHANNEL_BENCHMARKS, currentSoll(). Wird von Phase 3 wiederverwendet.
- Panels: VitalsPanel (Progress + 14-Tage-Sparkline als inline-SVG), DocumentsPanel (Runs-Liste), CommandDeck (3 Buttons, disabled solange Runner offline), PrimaryDirective (Monatsumsatz vs. Soll, „Ernte folgt dem Lag"-Hinweis statt Alarm).
- CockpitHome: 3-Spalten-Grid (Vitals+Docs | Graph+Directive | Command Deck).

**Entschieden:**
- Klick-Verhalten: Deals → /crm, Notizen → obsidian://-URL, Runs → Panel folgt in Phase 5.
- Mock-Hooks (`useVitalsMock`) haben exakt die Ziel-Form, damit Phase 3 nur die Datenquelle tauscht.

**Offen:**
- Visuelle Verifizierung hinter Auth (wie Phase 1) — Kevin-Login im Preview ausstehend.
