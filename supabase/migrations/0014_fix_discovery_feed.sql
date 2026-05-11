-- Discovery feed: archived_at (idempotent — 0013 enthält dieselbe Spalte bereits für frische Deployments)
ALTER TABLE discovery_feed_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
