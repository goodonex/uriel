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
