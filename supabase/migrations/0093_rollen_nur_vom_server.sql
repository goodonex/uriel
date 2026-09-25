-- 0093 — Rollen vergibt nur noch der Server (25.09.2026)
--
-- **Der Befund.** Beim Einbau von „Mit Google anmelden" fiel auf: Die
-- Selbst-Registrierung war offen und bestätigte Adressen automatisch. Wer sich
-- registrierte, bekam beim ersten Laden vom Browser aus eine `user_roles`-Zeile
-- mit `role = 'owner'` (useAuth.ensureOwnerRow) — erlaubt durch
-- "user_roles_insert_own" aus 0009. Zwei fremde Konten vom 16.05.2026 tragen
-- genau so eine Zeile. Die Registrierung ist seit heute zu
-- (disable_signup = true); diese Migration sorgt dafür, dass das Loch nicht
-- wieder aufgeht, falls sie jemals wieder eingeschaltet wird.
--
-- **Was die alten Policies zusätzlich erlaubten, auch ohne Registrierung:**
--
--   1. Jeder angemeldete Nutzer darf seine eigene Rollen-Zeile ändern. Ein
--      Portal-Kunde kann sich damit selbst zum Owner machen oder `project_id`
--      auf ein fremdes Projekt setzen — und sieht dann dessen Portal, Dateien
--      und Nachrichten (client_can_read_brand, client_portal_project_id lesen
--      genau diese Spalte).
--   2. Jeder angemeldete Nutzer darf eine `brands`-Zeile anlegen. Genau das ist
--      die einzige Bedingung der Lese-Policy auf `runner-files` (0083) — ein
--      Portal-Kunde kommt so an Loom-Skripte, Sales-PDFs und Kundenordner.
--   3. `push_log` liest jeder Angemeldete, Portal-Kunden eingeschlossen.
--   4. `ad_clicks` nimmt Einträge für jede Brand an (`with check (true)`).
--      Geschrieben wird dort nur von track-click mit service_role.
--
-- **Die neue Grenze.** Rollen schreibt ausschließlich service_role (die
-- Function invite-client, die an RLS vorbeigeht). Dadurch wird
-- `role = 'owner'` zu einer Aussage, der die Datenbank trauen kann — und alle
-- Agentur-Rechte, die bisher nur an „besitzt irgendeine Brand" hingen, hängen
-- jetzt zusätzlich daran.

-- ---------------------------------------------------------------------------
-- Prüffunktion: Ist der aktuelle Nutzer Agentur-Owner?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER wie client_can_read_brand (0023): liest user_roles unter
-- Funktions-Rechten, damit keine RLS-Kette entsteht und die Storage-Policy
-- nicht vom search_path des Storage-Kontexts abhängt.
create or replace function public.is_workspace_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'owner'
  );
$$;

revoke all on function public.is_workspace_owner() from public;
grant execute on function public.is_workspace_owner() to authenticated;

comment on function public.is_workspace_owner() is
  'true, wenn auth.uid() in user_roles als owner steht. Seit 0093 vergibt nur service_role Rollen.';

-- ---------------------------------------------------------------------------
-- 1) user_roles: nur noch lesen, und nur die eigene Zeile
-- ---------------------------------------------------------------------------
drop policy if exists "user_roles_insert_own" on public.user_roles;
drop policy if exists "user_roles_update_own" on public.user_roles;
drop policy if exists "user_roles_delete_own" on public.user_roles;

-- Zweite Sicherung neben RLS: Selbst eine künftig versehentlich angelegte
-- Schreib-Policy greift ohne Tabellenrecht nicht.
revoke insert, update, delete on public.user_roles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) brands: anlegen nur als Owner
-- ---------------------------------------------------------------------------
-- "brands_policy" steht in keiner Migration (im Dashboard entstanden) und
-- doppelt die vier Owner-Policies aus 0023 — nur erlaubt sie das Anlegen ohne
-- Rollenprüfung. Permissive Policies werden verodert, deshalb muss sie weg.
drop policy if exists "brands_policy" on public.brands;

drop policy if exists "brands_insert_owner" on public.brands;
create policy "brands_insert_owner" on public.brands
  for insert
  to authenticated
  with check (auth.uid() = user_id and public.is_workspace_owner());

-- ---------------------------------------------------------------------------
-- 3) runner-files: nur Owner mit eigener Brand
-- ---------------------------------------------------------------------------
-- Die Pfade im Bucket (jophiel/, kunden/, sales/, social/) tragen keinen
-- Nutzer — der Runner spiegelt Kevins Ordner. Eine Pfad-Bindung gibt es also
-- nicht; die Grenze ist die Owner-Rolle.
drop policy if exists "runner_files_owner_read" on storage.objects;
create policy "runner_files_owner_read" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'runner-files'
    and public.is_workspace_owner()
    and exists (select 1 from public.brands b where b.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4) push_log: nur Owner
-- ---------------------------------------------------------------------------
drop policy if exists "push_log_select_authenticated" on public.push_log;
drop policy if exists "push_log_select_owner" on public.push_log;
create policy "push_log_select_owner" on public.push_log
  for select
  to authenticated
  using (public.is_workspace_owner());

-- ---------------------------------------------------------------------------
-- 5) ad_clicks: schreiben nur in die eigene Brand
-- ---------------------------------------------------------------------------
drop policy if exists "ad_clicks_via_brand" on public.ad_clicks;
create policy "ad_clicks_via_brand" on public.ad_clicks
  for all
  using (exists (select 1 from public.brands b where b.id = ad_clicks.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.brands b where b.id = ad_clicks.brand_id and b.user_id = auth.uid()));

-- Nachprüfen mit echten Sitzungen (Kevin + Portal-Testkonto):
-- `npx tsx scripts/verify-rollen-schutz.ts`
