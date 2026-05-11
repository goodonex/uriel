-- Brand OS — Promo: Content-Ideen & Sequenzen

create extension if not exists "pgcrypto";

CREATE TABLE IF NOT EXISTS content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  hook text NOT NULL DEFAULT '',
  a_roll text NOT NULL DEFAULT '',
  b_roll text NOT NULL DEFAULT '',
  skript text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT 'post',
  kanal text NOT NULL DEFAULT 'linkedin',
  status text NOT NULL DEFAULT 'idee',
  woche integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_ideas_brand_idx ON content_ideas (brand_id);

CREATE TABLE IF NOT EXISTS content_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  wochen integer NOT NULL DEFAULT 4,
  plan jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'aktiv',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_sequences_brand_idx ON content_sequences (brand_id);

-- RLS
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_ideas_via_brand" ON content_ideas;
CREATE POLICY "content_ideas_via_brand" ON content_ideas
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM brands b WHERE b.id = content_ideas.brand_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM brands b WHERE b.id = content_ideas.brand_id AND b.user_id = auth.uid())
  );

ALTER TABLE content_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_sequences_via_brand" ON content_sequences;
CREATE POLICY "content_sequences_via_brand" ON content_sequences
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM brands b WHERE b.id = content_sequences.brand_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM brands b WHERE b.id = content_sequences.brand_id AND b.user_id = auth.uid())
  );
