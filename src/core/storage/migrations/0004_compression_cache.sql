CREATE TABLE IF NOT EXISTS compression_artifacts (
  compression_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
  repo_snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  worktree_state_id TEXT REFERENCES worktree_states(worktree_state_id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('symbol_outline', 'rule_digest', 'context_pack_summary')),
  method TEXT NOT NULL CHECK (method IN ('deterministic')),
  summary_text TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  scope_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  trust_status TEXT NOT NULL CHECK (trust_status IN ('derived_cache', 'stale', 'invalid')),
  invalidated_at TEXT,
  invalidation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compression_inputs (
  compression_input_id TEXT PRIMARY KEY,
  compression_id TEXT NOT NULL REFERENCES compression_artifacts(compression_id) ON DELETE CASCADE,
  input_kind TEXT NOT NULL CHECK (input_kind IN ('claim', 'proof', 'file', 'rule', 'test', 'symbol', 'context_artifact', 'config', 'lockfile')),
  input_ref TEXT NOT NULL,
  input_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compression_artifacts_snapshot_type ON compression_artifacts(repo_snapshot_id, artifact_type);
CREATE INDEX IF NOT EXISTS idx_compression_inputs_artifact ON compression_inputs(compression_id);
