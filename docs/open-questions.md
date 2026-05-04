# Brand OS — Offene Produkt-/Tech-Fragen

## APIs Promo (Instagram Graph, LinkedIn Analytics)

Echte OAuth-Flows und Token-Speicherung sind bewusst nicht Teil der aktuellen UI-Mocks. Offen:

- Wo liegen Refresh Tokens (Supabase Vault vs. Edge Function Secrets)?
- Welche Konten pro Brand (Business Manager / Org Pages)?
- Rate Limits und Batch-Sync-Intervalle?

## Discovery Cron (Supabase Edge Functions)

Scheduling, Retry und Benachrichtigung bei Feed-Fehlern — erst nach Backend-Entscheid.
