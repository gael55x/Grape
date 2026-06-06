CREATE TABLE IF NOT EXISTS claim_edge_authority (
  edge_id TEXT PRIMARY KEY REFERENCES claim_edges(edge_id) ON DELETE CASCADE,
  created_by TEXT NOT NULL CHECK (created_by IN ('deterministic_rule', 'model_suggestion', 'user_confirmation', 'test_verification', 'grape_observed', 'trusted_import', 'review_metadata', 'legacy')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reason TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_claim_edge_authority_created_by
  ON claim_edge_authority(created_by, created_at);
