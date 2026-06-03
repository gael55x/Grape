# V1 Testing

## Purpose

Define required test categories and fixture rules before implementation starts.

## Source Of Truth

Testing requirements enforce `docs/v1/SPEC.md`, `docs/v1/architecture/state-machine.md`, and `docs/v1/architecture/invariants.md`.

## Update Triggers

- new behavior class
- new fixture type
- new invariant
- new benchmark

## Agent Checks

Before editing code, agents must identify:

- touched invariants,
- touched state transitions,
- required unit/integration/golden/contract tests,
- required fixtures,
- required benchmark updates, if any.

No production behavior is complete without tests for the related state transition or invariant.

The in-memory smoke harness guards file shape and obvious contract drift. Project Skeleton And Tooling adds stronger local gates: `npm run architecture:check` for import-boundary drift, `npm run storage:check` for migration-contract drift, `npm run typecheck` for TypeScript compilation, `npm run package:check` for global package dry-run contents, and `npm run test:behavior` for Node's built-in behavioral tests over compiled source. Behavior tests run with `--test-concurrency=1` because CLI/MCP integration tests create many temporary Git repositories and SQLite databases; deterministic storage behavior is more important than parallel test throughput. Contributors should install with `npm ci` so checks use the pinned toolchain from `package-lock.json`.

## Test Categories

| Category | Purpose | Required for |
|---|---|---|
| Unit tests | Validate pure state, trust, scope, validation, path, hash, redaction, and policy functions. | every module with deterministic logic |
| State transition tests | Validate `from`, `to`, trigger, validation, side effects, persistence, invalidation. | every state/event change |
| Integration tests | Exercise multi-module workflows through application services. | repo sync, trust promotion, compile, diff, restore |
| Storage migration tests | Apply migrations from empty and previous schemas. | every schema change |
| Trust safety tests | Prevent fake memory, bad proofs, stale proofs, scope leaks. | trust/proofs/claims/retrieval |
| Compression safety tests | Prove compression cannot become truth and invalidates on input changes. | compression/compiler/diff |
| Artifact golden tests | Validate stable JSON and Markdown rendering. | compiler/MCP/CLI contract changes |
| Context diff tests | Validate session ledgers, pinned resend, omission, invalidation, restore. | diff/sessions |
| MCP contract tests | Validate request/response schemas and write boundaries. | MCP tool changes |
| CLI snapshot tests | Validate human output and exit codes. | CLI command changes |
| Security/redaction tests | Validate ignored files, approvals, secret blocking, logs. | security/evidence/compiler/storage |
| Cross-platform path tests | Validate path normalization and case behavior. | git/storage/indexing/security |
| Benchmark tests | Validate benchmark harness determinism and thresholds. | benchmark changes |

## Required Named Tests

Trust and scope:

- `no_proof_rejects_durable_claim`
- `summary_as_proof_rejected`
- `validated_source_proof_rows_persist_idempotently`
- `invalid_source_proof_hash_is_rejected`
- `validated_source_claims_persist_after_proofs`
- `source_claim_candidate_rejected_without_proof`
- `partially_verified_not_current_valid_by_default`
- `scope_resolution_precedes_current_valid_filter`
- `branch_invalid_claim_excluded`
- `dirty_worktree_claim_not_branch_global`
- `repo_file_claim_does_not_overclaim_runtime_behavior`

Artifact and diff:

- `context_artifact_requires_dependency_manifest`
- `context_section_requires_content_hash`
- `high_risk_without_task_exact_context_is_unsafe`
- `high_risk_with_task_exact_context_is_not_unsafe`
- `path_like_test_seed_selects_exact_source_without_runtime_claim`
- `related_test_import_selects_exact_source_without_runtime_claim`
- `task_selected_exact_source_evidence_excludes_unrelated_fillers`
- `task_scoped_current_valid_claims_exclude_unrelated_active_claims`
- `multi_window_exact_source_excerpts_use_distant_task_anchors`
- `multi_window_exact_source_excerpts_use_query_fallback_without_anchors`
- `token_budget_prunes_only_optional_context`
- `budget_omitted_sections_are_removed_from_public_artifact_body`
- `artifact_hash_is_deterministic`
- `diff_is_session_scoped`
- `unknown_session_forces_full_resend`
- `pinned_context_is_resent`
- `omit_unchanged_requires_restore_or_safe_reason`
- `restore_token_rejects_stale_dependency`
- `restore_token_rejects_stale_proof_dependency`
- `context_pack_summary_excludes_currently_invalidated_sent_items`

Compression:

- `compression_artifact_requires_input_hashes`
- `compression_artifact_never_valid_proof`
- `rule_digest_tracks_active_rule_hashes`
- `context_pack_summary_is_deterministic`
- `compression_dependency_is_in_artifact_manifest`
- `high_risk_overlay_forbids_summary_replacement`
- `stale_compression_emits_invalidated_previous_when_sent`
- `section_dependency_drift_does_not_invalidate_unrelated_context`

MCP and CLI:

- `mcp_get_context_returns_structured_items`
- `mcp_get_proofs_does_not_show_raw_secret`
- `mcp_write_tool_cannot_promote_claim`
- `agent_reported_test_result_is_temporary`
- `agent_reported_candidate_is_non_durable`
- `user_decision_requires_direct_confirmation_hashes`
- `confirmation_request_does_not_persist_truth`
- `cli_json_matches_schema`
- `cli_bench_reports_fixture_token_reduction`
- `cli_bench_requires_named_fixture`
- `cli_doctor_privacy_redacts_secrets`
- `cli_init_repairs_unusable_local_database`
- `cli_compile_repairs_unusable_local_database`

Storage and security:

- `migration_applies_from_empty_database`
- `migration_checksums_are_recorded`
- `wal_mode_and_busy_timeout_configured`
- `session_lock_survives_process_boundary`
- `ignored_file_not_indexed_without_approval`
- `unsupported_language_gets_safe_lexical_fallback_with_warning`
- `polyglot_repo_reports_provider_capability_gaps`
- `monorepo_retrieval_preserves_package_boundaries`
- `package_manifest_change_invalidates_package_scoped_context`
- `raw_env_value_not_in_artifact`
- `redacted_display_hash_not_used_as_proof`
- `path_normalization_handles_windows_separators`
- `package_dry_run_contains_cli_and_migrations`

## Required Fixture Repositories

- `clean-typescript-app`
- `dirty-worktree-repo`
- `branch-switch-repo`
- `stale-proof-repo`
- `ignored-files-secrets-repo`
- `no-tests-repo`
- `dynamic-imports-repo`
- `monorepo-lite-repo`
- `auth-security-fixture`
- `compression-invalidation-fixture`
- `session-reset-fixture`
- `parallel-agents-fixture`
- `polyglot-fallback-repo`

## Fixture Mapping

| Fixture | Must exercise |
|---|---|
| `clean-typescript-app` | clean snapshot, symbol index, first artifact, no-change diff |
| `dirty-worktree-repo` | dirty scope, worktree-local claims, partial warnings |
| `branch-switch-repo` | branch-invalid claims and sent item invalidation |
| `stale-proof-repo` | proof hash mismatch invalidates claims/artifacts |
| `ignored-files-secrets-repo` | ignored files, `.env`, redaction/blocking, approval flow |
| `no-tests-repo` | missing verification warnings without false certainty |
| `dynamic-imports-repo` | partial graph coverage and blind spots |
| `monorepo-lite-repo` | package boundaries and path normalization |
| `auth-security-fixture` | high-risk exact context and pinned rules |
| `compression-invalidation-fixture` | input hash changes and `INVALIDATE_PREVIOUS` |
| `session-reset-fixture` | full resend after reset/unknown session |
| `parallel-agents-fixture` | session isolation and lock conflicts |
| `polyglot-fallback-repo` | unsupported-language fallback, provider capability gaps, safe exact/path/lexical context, and no false graph claims |

## Review Rule

Any test that asserts "should include useful context" is too vague. It must assert concrete IDs, states, hashes, warnings, omissions, invalidations, or schema fields.
