# Brand OS — Offene Produkt-/Tech-Fragen

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

### Kundenportal (`/portal/:projectId`)

- Shell unter `ClientPortal.tsx`; vorerst **jede eingeloggte Session** (Owner testet mit Projekt-UUID).
- Daten kommen aus **localStorage** `deliver-projects` über alle Brand-Slugs; später Supabase + Policies für `role = client`.

## APIs Promo (Instagram Graph, LinkedIn Analytics)

Echte OAuth-Flows und Token-Speicherung sind bewusst nicht Teil der aktuellen UI-Mocks. Offen:

- Wo liegen Refresh Tokens (Supabase Vault vs. Edge Function Secrets)?
- Welche Konten pro Brand (Business Manager / Org Pages)?
- Rate Limits und Batch-Sync-Intervalle?

## Discovery Cron (Supabase Edge Functions)

Scheduling, Retry und Benachrichtigung bei Feed-Fehlern — erst nach Backend-Entscheid.
