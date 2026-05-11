-- Brand OS — Sales CRM: Potenzial, Custom Fields, Field Configs

-- --- contacts: Potenzial & Skript-Felder (JSON) ---
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS potenzial_betrag integer NOT NULL DEFAULT 0;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS potenzial_typ text NOT NULL DEFAULT 'einmalig';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS potenzial_notiz text NOT NULL DEFAULT '';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN contacts.potenzial_betrag IS 'Geschätzter Auftragswert EUR';
COMMENT ON COLUMN contacts.potenzial_typ IS 'einmalig | monatlich | jährlich';
COMMENT ON COLUMN contacts.custom_fields IS 'Werte für konfigurierbare Sales-Felder (key = field id)';

-- --- Sales Feld-Konfiguration pro Brand ---
CREATE TABLE IF NOT EXISTS sales_field_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  tab text NOT NULL CHECK (tab IN ('erstgespraech', 'qualifikation')),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, tab)
);

CREATE INDEX IF NOT EXISTS sales_field_configs_brand_idx
  ON sales_field_configs (brand_id);

ALTER TABLE sales_field_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_field_configs_owner" ON sales_field_configs;
CREATE POLICY "sales_field_configs_owner" ON sales_field_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM brands b
      WHERE b.id = sales_field_configs.brand_id
        AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brands b
      WHERE b.id = sales_field_configs.brand_id
        AND b.user_id = auth.uid()
    )
  );
