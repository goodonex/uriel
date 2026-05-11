-- Brand OS — Sequenzen: Content vs. E-Mail

ALTER TABLE content_sequences
  ADD COLUMN IF NOT EXISTS sequence_kind text NOT NULL DEFAULT 'content';

COMMENT ON COLUMN content_sequences.sequence_kind IS 'content | email';
