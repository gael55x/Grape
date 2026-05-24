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
  dirty_state TEXT NOT NULL CHECK (dirty_state IN ('clean', 'dirty', 'unknown')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worktree_states (
  worktree_state_id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('clean', 'dirty', 'unknown')),
  dirty_paths_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  snapshot_id TEXT REFERENCES repo_snapshots(snapshot_id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('repository_file', 'git_diff', 'test_run', 'command_run', 'user_message', 'tool_call', 'runtime_log', 'ci_job', 'assistant_response', 'manual_import', 'rule_file', 'config_file', 'lockfile', 'migration_file', 'commit_message')),
  source_ref TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_scope TEXT NOT NULL CHECK (source_scope IN ('committed', 'staged', 'unstaged', 'untracked', 'external')),
  trust_class TEXT NOT NULL CHECK (trust_class IN ('trusted', 'temporary', 'untrusted')),
  privacy_status TEXT NOT NULL CHECK (privacy_status IN ('allowed', 'ignored', 'private', 'blocked_secret')),
  redaction_status TEXT NOT NULL CHECK (redaction_status IN ('not_needed', 'redacted', 'blocked')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_rejections (
  rejection_id TEXT PRIMARY KEY,
  source_ref TEXT NOT NULL,
  rejection_reason TEXT NOT NULL,
  privacy_status TEXT NOT NULL CHECK (privacy_status IN ('allowed', 'ignored', 'private', 'blocked_secret')),
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
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'partially_verified', 'unverified', 'refuted', 'stale')),
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
  support_status TEXT NOT NULL CHECK (support_status IN ('direct', 'indirect', 'partial', 'context_only', 'contradicts')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_edges (
  edge_id TEXT PRIMARY KEY,
  source_claim_id TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  target_claim_id TEXT NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('supersedes', 'contradicts', 'depends_on', 'validated_by', 'caused_by', 'related_to', 'narrows', 'broadens', 'needs_review', 'violates', 'coexists_with', 'variant_of', 'unknown_scope_overlap')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_rules (
  rule_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  rule_ref TEXT NOT NULL,
  rule_hash TEXT NOT NULL,
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)),
  scope_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_sessions (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
  repo_snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  worktree_state_id TEXT NOT NULL REFERENCES worktree_states(worktree_state_id) ON DELETE CASCADE,
  agent_name TEXT,
  agent_session_id TEXT,
  task_id TEXT,
  task_type TEXT CHECK (task_type IN ('bug_fix', 'security_fix', 'refactor', 'migration', 'feature', 'test_repair', 'analysis', 'bootstrap')),
  branch_name TEXT NOT NULL,
  base_commit_sha TEXT,
  head_commit_sha TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'invalidated')),
  lock_token TEXT,
  lock_status TEXT NOT NULL CHECK (lock_status IN ('unlocked', 'locked', 'expired', 'contended')),
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
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
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  artifact_hash TEXT NOT NULL,
  dependency_manifest_hash TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('bug_fix', 'security_fix', 'refactor', 'migration', 'feature', 'test_repair', 'analysis', 'bootstrap')),
  risk_overlays_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  unsafe_reasons_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (artifact_id, session_id)
);

CREATE TABLE IF NOT EXISTS context_dependencies (
  dependency_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES context_artifacts(artifact_id) ON DELETE CASCADE,
  dependency_kind TEXT NOT NULL CHECK (dependency_kind IN ('file', 'source', 'claim', 'proof', 'rule', 'config', 'lockfile', 'symbol', 'test', 'compression_artifact')),
  dependency_ref TEXT NOT NULL,
  dependency_hash TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS context_sent_items (
  sent_item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  task_id TEXT,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('claim', 'proof', 'code_span', 'rule', 'test_output', 'symbol_summary', 'compression_artifact', 'open_question', 'context_summary', 'invalidation', 'restore_hint')),
  item_ref TEXT NOT NULL,
  item_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  dependency_manifest_hash TEXT NOT NULL,
  was_pinned INTEGER NOT NULL CHECK (was_pinned IN (0, 1)),
  last_diff_state TEXT NOT NULL CHECK (last_diff_state IN ('NEW', 'CHANGED', 'PINNED', 'OMIT_UNCHANGED', 'INVALIDATE_PREVIOUS', 'RESTORE_AVAILABLE')),
  omit_reason TEXT,
  restore_hint TEXT,
  session_reset_id TEXT,
  first_sent_at TEXT NOT NULL,
  last_sent_at TEXT NOT NULL,
  send_count INTEGER NOT NULL CHECK (send_count > 0),
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  FOREIGN KEY (artifact_id, session_id) REFERENCES context_artifacts(artifact_id, session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS omitted_context_items (
  omitted_item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('claim', 'proof', 'code_span', 'rule', 'test_output', 'symbol_summary', 'compression_artifact', 'open_question', 'context_summary', 'invalidation', 'restore_hint')),
  item_ref TEXT NOT NULL,
  item_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  dependency_manifest_hash TEXT NOT NULL,
  last_diff_state TEXT NOT NULL CHECK (last_diff_state IN ('NEW', 'CHANGED', 'PINNED', 'OMIT_UNCHANGED', 'INVALIDATE_PREVIOUS', 'RESTORE_AVAILABLE')),
  reason_omitted TEXT NOT NULL CHECK (reason_omitted IN ('unchanged_restorable', 'not_relevant', 'unsafe_to_send', 'blocked_by_policy')),
  can_restore INTEGER NOT NULL CHECK (can_restore IN (0, 1)),
  restore_id TEXT,
  restore_command TEXT,
  omitted_at TEXT NOT NULL,
  send_count INTEGER NOT NULL CHECK (send_count > 0),
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  CHECK (can_restore = 0 OR (restore_id IS NOT NULL AND restore_command IS NOT NULL)),
  FOREIGN KEY (artifact_id, session_id) REFERENCES context_artifacts(artifact_id, session_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_pack_items (
  pack_item_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES context_sessions(session_id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL,
  section_id TEXT,
  diff_state TEXT NOT NULL CHECK (diff_state IN ('NEW', 'CHANGED', 'PINNED', 'OMIT_UNCHANGED', 'INVALIDATE_PREVIOUS', 'RESTORE_AVAILABLE')),
  item_kind TEXT NOT NULL CHECK (item_kind IN ('claim', 'proof', 'code_span', 'rule', 'test_output', 'symbol_summary', 'compression_artifact', 'open_question', 'context_summary', 'invalidation', 'restore_hint')),
  item_ref TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  pinned INTEGER NOT NULL CHECK (pinned IN (0, 1)),
  safety_critical INTEGER NOT NULL CHECK (safety_critical IN (0, 1)),
  invalidates_sent_item_id TEXT REFERENCES context_sent_items(sent_item_id) ON DELETE SET NULL,
  restore_id TEXT,
  input_refs_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (artifact_id, session_id) REFERENCES context_artifacts(artifact_id, session_id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_context_sessions_project_agent ON context_sessions(project_id, agent_name, agent_session_id);
CREATE INDEX IF NOT EXISTS idx_context_sessions_repo_head ON context_sessions(repo_id, branch_name, head_commit_sha);
CREATE INDEX IF NOT EXISTS idx_context_sent_items_session_section ON context_sent_items(session_id, section_id);
CREATE INDEX IF NOT EXISTS idx_context_sent_items_session_ref ON context_sent_items(session_id, item_kind, item_ref);
CREATE INDEX IF NOT EXISTS idx_omitted_context_items_session_restore ON omitted_context_items(session_id, restore_id);
CREATE INDEX IF NOT EXISTS idx_context_pack_items_session ON context_pack_items(session_id, artifact_id);
