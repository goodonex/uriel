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
