# Brand OS — Offene Produkt-/Tech-Fragen

## 3D-Hintergrund / Canvas

- Auf allen Routen außer `/` hat das R3F-Canvas `pointer-events: none` — UI-Overlay hat Vorrang; Universe (`/`) bleibt klickbar für Brand-Tunnel.
- Ambient-Nodes (unten rechts) skalieren mit Viewport-Breite, Obergrenze ca. 20 % — Feintuning nach Feedback möglich.

## TypeScript / Build

- `tsc -b` und `npm run build` (App) sind aktuell fehlerfrei; es gibt keine gemeldeten offenen TS-Fehler in dieser Liste.

## Supabase Migrationen (manuell im Dashboard ausführen)

Im Supabase SQL Editor **der Reihe nach** ausführen:

| Datei | Tabellen / Änderungen |
|-------|------------------------|
| `0001_brands.sql` | `brands` |
| `0002_foundation.sql` | `foundation_icps`, `foundation_word_bank`, `foundation_positioning` |
| `0003_promo.sql` | `campaigns`, `content_pieces` |
| `0004_sales.sql` | `contacts` |
| `0005_building.sql` | `assets`, `sops`, `foundation_business_models` |
| `0006_discovery.sql` | `discovery_foundation`, `discovery_feed_items`, `discovery_settings` |
| `0007_auth.sql` | `user_roles` (Rollen `owner` / `client`, optional `client_slug` → `brands.slug`) |
| `0008_deliver.sql` | `deliver_projects` |
| `0009_rls.sql` | Row Level Security für alle App-Tabellen inkl. `deliver_projects` |
| `0010_deliver_projects.sql` | `deliver_projects`: Stages, Tiptap-Doc, Dateilinks, Kundeninhalt |
| `0011_contacts_extended.sql` | `contacts`: Profilfelder + `activity_log` |

**Reihenfolge:** `0001` … `0008`, **`0010_deliver_projects.sql`**, **`0011_contacts_extended.sql`** (Spalten-Erweiterungen), danach **`0009_rls.sql`** falls noch nicht ausgeführt.

Offen nach Umstellung auf Auth/RLS:

- Client-Rolle: welche Tabellen/Zeilen dürfen `role = client` lesen (Portal)?
- `user_roles.client_slug` vs. spätere Zuordnung Brand↔Client.

### Sales / Pipeline

- Server-Kontakte mit leeren Namen/Feldern werden beim Merge mit **localStorage** angereichert (Demo-Daten bleiben sichtbar, bis echte Daten in Supabase gepflegt sind).

## Kundenportal (`/portal/:projectId`)

- UI: Brand-Name + Projektname, Fortschrittsbalken (5 Stages), Willkommenstext, Dokumente &amp; Links, **Updates** aus `team_notes` (Absätze getrennt). Heller Glass-Hintergrund zur Abgrenzung vom internen Bereich.
- Willkommenstext bearbeitet der **Owner** in `ProjectPage`; Portal ist read-only.
- Shell unter `ClientPortal.tsx`; vorerst **jede eingeloggte Session** (Owner testet mit Projekt-UUID).
- Daten kommen aus **localStorage** `deliver-projects` über alle Brand-Slugs; später Supabase + Policies für `role = client`.

## APIs Promo (Instagram Graph, LinkedIn Analytics)

Echte OAuth-Flows und Token-Speicherung sind bewusst nicht Teil der aktuellen UI-Mocks. Offen:

- Wo liegen Refresh Tokens (Supabase Vault vs. Edge Function Secrets)?
- Welche Konten pro Brand (Business Manager / Org Pages)?
- Rate Limits und Batch-Sync-Intervalle?

## Discovery Cron (Supabase Edge Functions)

Scheduling, Retry und Benachrichtigung bei Feed-Fehlern — erst nach Backend-Entscheid.
