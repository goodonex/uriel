# Brand OS — Handoff (Stand für neuen Cursor-Chat)

Kurzüberblick zum Einstieg. Details: `docs/system.md`, `docs/data-model.md`, `docs/open-questions.md`.

---

## Was existiert

### Zwei „Codebases“ (ein Repo)

| Teil | Pfad | Inhalt |
|------|------|--------|
| **Frontend** | `app/` | React 19 + TypeScript + Vite 8, React Router 7, Tailwind, Three.js (R3F), Framer Motion, Supabase Client, Zustand |
| **Backend (Supabase)** | `supabase/` | SQL-Migrationen `0001`–`0013`, Edge Functions, `config.toml` (JWT pro Function) |

### Was grundsätzlich funktioniert

- **6 Modi**: Building, Discovery, Promo, Sales, Deliver, Intelligence — Navigation & Routen (`/brand/:slug/...`).
- **Brands**: Liste aus Supabase (mit Fallback/localStorage bei fehlender DB); Sortierung fester Slug-Reihenfolge; **Universe**-3D-Graph (`app/src/three/NodeGraph.tsx`) mit Brand-Nodes.
- **Auth**: Supabase Auth + `useAuth`; `useBrands` hängt an eingeloggtem User.
- **Foundation**: ICPs, Word Bank, Positioning (Tabellen + localStorage-Fallbacks in Hooks).
- **Discovery**: Edge Function **`discovery-agent`** (Claude inkl. Web-Search-Tool + Speichern in `discovery_foundation` / Feed-Items); **`discovery-feed-refresh`** (Signale, Archiv >90 Tage; Cron + optional User-Invoke).
- **Deliver / Sales / Promo / Client-Portal**: UI + Schema laut Migrationen (Details in `docs/` und SQL).
- **Build**: `cd app && npx tsc -b && npm run build` — zuletzt grün im Projektverlauf.

---

## Zuletzt umgesetzt (Branding, Daten, Sessions)

- **Branding / Brand-Liste**: Offmarketbude → **Wertavio**; **Eversmell**, **Culturefit** (Farbe **Ember** `var(--accent-ember)` / `#e0593e` in 3D), **Homeflower** zuletzt in der Anzeige; Sync `offmarketbude` → `wertavio` + fehlende Brands per `useBrands` (`syncCanonicalBrandsForUser`).
- **Wertavio Startdaten**: localStorage unter Slug `wertavio` (Positioning, Business Model, 2 ICPs, Word Bank) + Sentinel-Version; zusätzlich **Supabase-Foundation-Seed**, wenn Tabellen für die Wertavio-`brand_id` leer sind.
- **ModeNav-Reihenfolge**: Building → Discovery → Promo → Sales → Deliver → Intelligence.
- **Design-Tokens**: u. a. `--accent-ember` in `app/src/styles/tokens.css`.
- **DB / Setup** (lokal & Remote): Migrationen bis **`0013_discovery_agent.sql`** (`analysis_status`, `archived_at` für Feed); RLS in `0009` + Erweiterungen in späteren Migrationen — **im jeweiligen Supabase-Projekt manuell ausführen**, siehe `docs/open-questions.md`.
- **Sessions**: normale Supabase-Session im Browser; keine separaten „Session“-Experimente außerhalb davon.

---

## Offen / als Nächstes (Priorität)

1. **Role Guards**: Routen und ggf. UI hart absichern (Owner vs. Client, Portal nur mit `user_roles.project_id` etc.); RLS-Policy-Review mit Produktflow.
2. **Schema-Match**: Tabellen/Policies mit `docs/data-model.md` und `docs/open-questions.md` abgleichen (fehlende Policies, `invite-client`, ggf. neue Tabellen).
3. **Deploy**: Supabase Edge Functions deployen (`discovery-agent`, `discovery-feed-refresh`), Secrets setzen (`ANTHROPIC_API_KEY`, ggf. `DISCOVERY_CRON_SECRET`, … siehe `docs/open-questions.md`); Frontend-Build ausliefern; Cron-Header für Feed-Refresh.
4. **Peripher**: `invite-client`-Function ist Platzhalter; `supabase login` für CLI ist interaktiv (lokal erledigen).

---

## Technische Fakten

- **Stack**: siehe Tabelle oben; Entry `app/index.html` / `app/src/main.tsx`.
- **Supabase Project ID**: nicht im Git versioniert — **`VITE_SUPABASE_URL` in `app/.env.local`** (oder Dashboard): Project-Ref = **Subdomain** der URL (Teil vor `.supabase.co`). Beispielform: `https://<project-ref>.supabase.co`.
- **Edge Functions** (Auszug):
  - `discovery-agent`: `verify_jwt = true`
  - `discovery-feed-refresh`: `verify_jwt = false` (Auth/Cron im Handler)
- **Ordnerstruktur (Root)**:

```
uriel/
├── app/                 # Vite SPA (Port 5173: npm run dev)
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── three/
│   │   └── …
│   └── .env.local       # lokal: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (nicht committen)
├── docs/                # system, data-model, open-questions, …
├── supabase/
│   ├── config.toml
│   ├── functions/       # discovery-agent, discovery-feed-refresh, invite-client, …
│   └── migrations/
└── HANDOFF.md           # diese Datei
```

---

*Generiert als kompakte Übergabe; bei Abweichung zum Live-System immer Dashboard + `git log` prüfen.*
