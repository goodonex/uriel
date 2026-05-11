-- Assets: Social-Typ, Plattform, Notizen, Erstellungszeit (Building / HUD)

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_type_check;
ALTER TABLE assets ADD CONSTRAINT assets_type_check CHECK (
  type IN ('website', 'instagram', 'linkedin', 'document', 'social')
);

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS social_platform text,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE assets SET created_at = updated_at WHERE created_at IS NULL;

ALTER TABLE assets
  ALTER COLUMN created_at SET DEFAULT now();

COMMENT ON COLUMN assets.social_platform IS 'Bei type=social: linkedin | instagram | facebook | tiktok | youtube | twitter';
COMMENT ON COLUMN assets.notes IS 'Freitext-Notizen zum Asset';
