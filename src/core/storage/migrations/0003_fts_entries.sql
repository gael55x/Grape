CREATE TABLE IF NOT EXISTS fts_entries (
  fts_entry_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  source_ref TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS fts_entry_text USING fts5(
  fts_entry_id UNINDEXED,
  source_id UNINDEXED,
  source_ref UNINDEXED,
  body,
  tokenize = 'unicode61'
);

CREATE INDEX IF NOT EXISTS idx_fts_entries_snapshot_source ON fts_entries(snapshot_id, source_id);
CREATE INDEX IF NOT EXISTS idx_fts_entries_source_ref ON fts_entries(source_ref);
