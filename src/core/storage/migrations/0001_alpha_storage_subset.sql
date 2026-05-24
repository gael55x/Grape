PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  checksum_sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  grape_dir_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repos (
  repo_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  vcs_type TEXT NOT NULL,
  root_path TEXT NOT NULL,
  normalized_root_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repo_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  worktree_hash TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  dirty_state TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worktree_states (
  worktree_state_id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  dirty_paths_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  snapshot_id TEXT REFERENCES repo_snapshots(snapshot_id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  privacy_status TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_rejections (
  rejection_id TEXT PRIMARY KEY,
  source_ref TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  privacy_status TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  claim_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  scope_hash TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_candidates (
  candidate_id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES sources(source_id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  rejection_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proofs (
  proof_id TEXT PRIMARY KEY,
  claim_id TEXT REFERENCES claims(claim_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  excerpt_hash TEXT NOT NULL,
  support_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_edges (
  edge_id TEXT PRIMARY KEY,
  source_claim_id TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  target_claim_id TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_rules (
  rule_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  rule_ref TEXT NOT NULL,
  rule_hash TEXT NOT NULL,
  pinned INTEGER NOT NULL,
  scope_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_sessions (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  lock_token TEXT,
  lock_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_artifacts (
  artifact_id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES context_sessions(session_id) ON DELETE SET NULL,
  snapshot_id TEXT REFERENCES repo_snapshots(snapshot_id) ON DELETE SET NULL,
  artifact_hash TEXT NOT NULL,
  task_type TEXT NOT NULL,
  risk_overlays_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  unsafe_reasons_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_dependencies (
  dependency_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES context_artifacts(artifact_id) ON DELETE CASCADE,
  dependency_kind TEXT NOT NULL,
  dependency_ref TEXT NOT NULL,
  dependency_hash TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_sent_items (
  sent_item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES context_artifacts(artifact_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  diff_state TEXT NOT NULL,
  pinned INTEGER NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS omitted_context_items (
  omitted_item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES context_artifacts(artifact_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  restore_token TEXT NOT NULL,
  safe_omission_reason TEXT NOT NULL,
  omitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_pack_items (
  pack_item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES context_artifacts(artifact_id) ON DELETE CASCADE,
  section_id TEXT,
  diff_state TEXT NOT NULL,
  item_kind TEXT NOT NULL,
  item_ref TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  safety_critical INTEGER NOT NULL,
  input_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_repos_project ON repos(project_id);
CREATE INDEX IF NOT EXISTS idx_repo_snapshots_repo ON repo_snapshots(repo_id, branch, commit_sha);
CREATE INDEX IF NOT EXISTS idx_sources_snapshot_type ON sources(snapshot_id, source_type);
CREATE INDEX IF NOT EXISTS idx_claims_scope_status ON claims(scope_hash, verification_status);
CREATE INDEX IF NOT EXISTS idx_proofs_claim ON proofs(claim_id);
CREATE INDEX IF NOT EXISTS idx_context_sessions_project_agent ON context_sessions(project_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_context_sent_items_session_section ON context_sent_items(session_id, section_id);
CREATE INDEX IF NOT EXISTS idx_omitted_context_items_session_restore ON omitted_context_items(session_id, restore_token);
CREATE INDEX IF NOT EXISTS idx_context_pack_items_session ON context_pack_items(session_id, artifact_id);
