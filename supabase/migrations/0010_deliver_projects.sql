-- Brand OS — Deliver: Stages, Tiptap-Doc, Kundeninhalt (erweitert 0008)

ALTER TABLE deliver_projects
  ADD COLUMN IF NOT EXISTS client_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_stage text NOT NULL DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS client_stage text NOT NULL DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS internal_notes_doc jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_file_links text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS team_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_welcome_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_documents jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE deliver_projects DROP CONSTRAINT IF EXISTS deliver_projects_internal_stage_check;
ALTER TABLE deliver_projects ADD CONSTRAINT deliver_projects_internal_stage_check
  CHECK (internal_stage IN ('onboarding','discover','inner_world','visual_world','execute'));

ALTER TABLE deliver_projects DROP CONSTRAINT IF EXISTS deliver_projects_client_stage_check;
ALTER TABLE deliver_projects ADD CONSTRAINT deliver_projects_client_stage_check
  CHECK (client_stage IN ('onboarding','discover','inner_world','visual_world','execute'));

comment on column deliver_projects.internal_notes_doc is 'Tiptap JSON — interne Notizen';
comment on column deliver_projects.client_documents is 'Array {label, url} für Kundenportal';
