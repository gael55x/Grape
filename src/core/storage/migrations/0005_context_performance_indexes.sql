CREATE INDEX IF NOT EXISTS idx_context_pack_items_session_diff_invalidation
  ON context_pack_items(session_id, diff_state, invalidates_sent_item_id);

CREATE INDEX IF NOT EXISTS idx_context_pack_items_session_diff_payload
  ON context_pack_items(session_id, diff_state, created_at, pack_item_id);

CREATE INDEX IF NOT EXISTS idx_context_sent_items_session_scope_kind
  ON context_sent_items(session_id, branch_name, commit_sha, item_kind, section_id, last_sent_at);

CREATE INDEX IF NOT EXISTS idx_fts_entries_snapshot_ref
  ON fts_entries(snapshot_id, source_ref, fts_entry_id);
