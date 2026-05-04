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
| `0012_client_access.sql` | `user_roles.project_id`; RLS Client lesen eigenes `deliver_projects` + Brand |

**Reihenfolge:** `0001` … `0008`, **`0010_deliver_projects.sql`**, **`0011_contacts_extended.sql`**, **`0012_client_access.sql`**, danach **`0009_rls.sql`** ergänzen/aktualisieren (oder `0009` vor `0012` wenn Policies idempotent per `drop policy if exists` — empfohlen: **`0012` nach `0009` ausführen**, da neue Policies auf bestehendem RLS aufsetzen).

**Hinweis:** Nach `0012` existieren zusätzliche Policies; bei bestehendem `0009` einfach `0012` im SQL Editor ausführen.

Offen nach Umstellung auf Auth/RLS:

- Client-Einladung: Edge Function `invite-client` (Placeholder im Repo) — `admin.createUser` + Zeile in `user_roles`.
- `user_roles.client_slug` vs. spätere Zuordnung Brand↔Client (weiterhin optional).

### Sales / Pipeline

- Server-Kontakte mit leeren Namen/Feldern werden beim Merge mit **localStorage** angereichert (Demo-Daten bleiben sichtbar, bis echte Daten in Supabase gepflegt sind).
- **Schnell-Deal** (Drawer): Name, **Telefon** und **E-Mail** (getrennt), erste Notiz → Kontakt in **Erstkontakt** + Sprung zur Vollmaske.

## Deliver / Projektliste

- `DeliverMode`: leerer State mit zentralem CTA; bei Daten **2-Spalten-Grid** mit Glass-Cards; neues Projekt per **Drawer** (Name, Kontakt-Dropdown, Status).

## Kundenportal (`/portal/:projectId`)

- **Produktion:** Nur **`role = client`** mit gesetztem **`user_roles.project_id`** (UUID des Deliver-Projekts). Daten aus **Supabase** (`deliver_projects`); RLS siehe `0012_client_access.sql`. Nach Login Redirect `/portal/{project_id}`.
- **Owner** wird vom Portal ausgeschlossen (Redirect `/`) — Vorschau nur mit **`?preview=true`** (localStorage-Scan, Entwicklung).
- UI: eigenes Layout (`--bg-base`), Fortschritt in **Teal**, Willkommen (`client_welcome_text`), **Dein Projektstatus** (Timeline), **Dokumente &amp; Links** (optional `description`). Kein `team_notes`-Block mehr im Portal.
- **Portal-Link:** `ProjectPage` kopiert `origin/portal/{id}`; Toast-Bestätigung.

## Context Export (`buildContextMarkdown`)

- Enthält optional **`SALES_SNAPSHOT`** (Kontakte gesamt, Anzahl pro Pipeline-Stage, überfällige Follow-ups) und **`DELIVER_SNAPSHOT`** (aktive Projekte, Stages-Verteilung, jüngstes Projekt inkl. Stage) wenn Daten aus `useContacts` / `useDeliverProjects` übergeben werden (Building-Modus „Copy for Claude“).

## APIs Promo (Instagram Graph, LinkedIn Analytics)

Echte OAuth-Flows und Token-Speicherung sind bewusst nicht Teil der aktuellen UI-Mocks. Offen:

- Wo liegen Refresh Tokens (Supabase Vault vs. Edge Function Secrets)?
- Welche Konten pro Brand (Business Manager / Org Pages)?
- Rate Limits und Batch-Sync-Intervalle?

## Mobile (&lt; 768px) — Basis

- `AppHeader`: Brand-Switcher in **horizontal scroll** (`flex-1` + `overflow-x-auto`), Buttons `w-max` / `nowrap`.
- `ModeNav`: **2 Spalten** bis `md`, dann 3 / 6.
- Sales-**Pipeline**: Spaltenbreite `min(200px, 100vw - 48px)`, Board mit Touch-Scroll / `overscroll-x-contain`.
- `App`-`main`: engere horizontale Padding-Klassen auf kleinen Screens.
- `Drawer`: Breite `min(380px, 100vw - 24px)` — keine Überlagerung am Rand.

## Discovery Cron (Supabase Edge Functions)

Scheduling, Retry und Benachrichtigung bei Feed-Fehlern — erst nach Backend-Entscheid.
