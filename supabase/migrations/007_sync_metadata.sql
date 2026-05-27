-- Tracks the last time an automated sync ran, enabling stale-while-revalidate.
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with epoch so the first visitor triggers an immediate sync.
INSERT INTO sync_metadata (key, last_synced_at)
VALUES ('espn_sync', '1970-01-01T00:00:00Z')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only the service-role client can access this table.
