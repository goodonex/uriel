# Brand OS — Offene Produkt-/Tech-Fragen

## Supabase Migrationen 0001–0006 (manuell im Dashboard ausführen)

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

Offen nach Umstellung auf Auth/RLS:

- Client-Rolle: welche Tabellen/Zeilen dürfen `role = client` lesen (Portal)?
- `user_roles.client_slug` vs. spätere Zuordnung Brand↔Client.

## APIs Promo (Instagram Graph, LinkedIn Analytics)

Echte OAuth-Flows und Token-Speicherung sind bewusst nicht Teil der aktuellen UI-Mocks. Offen:

- Wo liegen Refresh Tokens (Supabase Vault vs. Edge Function Secrets)?
- Welche Konten pro Brand (Business Manager / Org Pages)?
- Rate Limits und Batch-Sync-Intervalle?

## Discovery Cron (Supabase Edge Functions)

Scheduling, Retry und Benachrichtigung bei Feed-Fehlern — erst nach Backend-Entscheid.
