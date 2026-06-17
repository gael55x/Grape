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

The in-memory smoke harness guards file shape and obvious contract drift. Project Skeleton And Tooling adds stronger local gates: `npm run architecture:check` for import-boundary drift, `npm run storage:check` for migration-contract drift, `npm run typecheck` for TypeScript compilation, `npm run package:check` for global package dry-run contents, and `npm run test:behavior` for Node's built-in behavioral tests over compiled source. Behavior and benchmark entrypoint scripts prune stale emitted `.tmp/build/src/**/*.js` files before compiling so files from earlier module layouts cannot affect CLI/MCP behavior tests without deleting the active compiled tree. Behavior tests live in domain folders under `tests/behavior/` and are discovered recursively by `scripts/run-behavior-tests.mjs`. The runner keeps `--test-concurrency=1` because CLI/MCP integration tests create many temporary Git repositories and SQLite databases; deterministic storage behavior is more important than parallel test throughput. Contributors should install with `npm ci` so checks use the pinned toolchain from `package-lock.json`.

## Package Script Gates

| Script | Purpose | Failure modes |
|---|---|---|
| `npm run check` | Default local gate: docs, fixtures, memory loop, architecture, storage, typecheck, package dry-run, install smoke, behavior tests. | Fix the named sub-check output; behavior tests print the failing contract and file. |
| `npm run test:connect` | Packs the current build, creates a consumer repo, runs normal `npm install <tarball>`, commits the install state, runs `npm exec -- grape init --connect`, then exercises the installed CLI and MCP core workflows as the CI/CD connect test. CLI coverage includes version/help, init/connect, status, doctor, privacy doctor, sync, two-turn compile, diff-context, omitted restore, sessions, artifacts, claims, proofs, dirty-source invalidation, and stale inspection. MCP coverage includes `initialize`, `tools/list`, `grape_get_status`, two-turn `grape_get_context`, omission, restore, source invalidation, stale restore rejection, mismatch recovery guidance, reset, branch invalidation, redaction checks, and ignored secret-looking file rejection. | CLI, MCP protocol, transport, missing connect guidance, or redaction failures throw with the failing step label. |
| `npm run benchmark:run` | Runs all scripted `grape bench --fixture <name>` scenarios and enforces token-reduction and invalidation thresholds. | Threshold failures report fixture name, turn metrics, and unsafe omission counts. |
| `npm run e2e:alpha` | Builds dist, packs the tarball, installs it in a temp repo, runs install smoke, and runs the benchmark suite from the installed package path. | Install or benchmark failures exit non-zero with script stderr. |
| `npm run beta:client-trial` | Release-language alias for `npm run test:connect`. | Same as `test:connect`. |
| `npm run beta:check` | Runs `check`, `benchmark:run`, `e2e:alpha`, and `test:connect` in order. | Stops at the first failing gate above. |

GitHub Actions runs `npm run check` on Ubuntu, macOS, and Windows, then runs `npm run test:connect` from the packed package on the same OS matrix. The final Ubuntu `beta-smoke` job runs `benchmark:run` and `e2e:alpha`.

The automated beta client trial proves MCP over stdio from a packaged install. It does not replace human trials in Cursor, Claude Code, or other IDE MCP clients when release policy requires a real client UI run. See [`planning/beta-trial-checklist.md`](../planning/beta-trial-checklist.md).

## Behavior Test Layout

`tests/behavior/` is split by behavior surface so release-blocking contracts are easy to find and extend:

| Folder | Owns |
|---|---|
| `benchmark/` | scripted fixture benchmark behavior |
| `cli/` | CLI rendering, exit-code, privacy, bootstrap, and fallback behavior |
| `compiler/` | context artifact compilation, budgeting, repository artifact, and diff behavior |
| `compression/` | compression cache and invalidation behavior |
| `contracts/` | serialized artifact and context-pack protocol contracts |
| `evidence/` | source evidence, proofs, claims, conflicts, and observed-run persistence |
| `indexing/` | file index and cross-platform path behavior |
| `mcp/` | MCP stdio contract and adapter behavior |
| `privacy-security/` | public artifact redaction and secret-scan behavior |
| `trust/` | trust wording guardrails and overclaim rejection |
| `retrieval/` | task source retrieval, source excerpts, and polyglot/monorepo fallback behavior |
| `snapshot/` | repository snapshot persistence and Git snapshot behavior |
| `storage/` | storage runtime, repositories, policy, and migration behavior |
| `helpers/` | test-only helpers imported by behavior tests |

New behavior tests should go in the folder that owns the user-visible contract they protect. Add a new folder only when the behavior has a clear module owner and would otherwise mix unrelated contracts.

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
- `current_valid_retrieval_respects_environment_scope`
- `current_valid_resolution_rejects_claims_scoped_to_another_current_environment`
- `feature_flag_scope_prevents_false_global_claim`
- `current_feature_flags_reject_mismatched_flag_scoped_claims`
- `current_valid_resolution_rejects_claims_scoped_to_another_current_feature_flag_value`
- `package_root_helper_derives_only_one_explicit_workspace_root`
- `current_valid_resolution_rejects_claims_scoped_to_another_current_package_root`
- `current_session_does_not_reject_branch_scoped_claims_without_session_scope`
- `current_valid_resolution_rejects_claims_scoped_to_another_current_session`
- `observed_test_run_without_task_file_ref_not_rendered`
- `monorepo_package_boundary_prevents_same_source_supersession`
- `validated_package_local_source_claims_record_package_root_scope`
- `unknown_scope_overlap_warning`
- `repo_file_claim_does_not_overclaim_runtime_behavior`
- `claim_type_policy_rejects_unknown_claim_type`
- `claim_type_policy_rejects_unproven_behavior_claim`
- `symbol_declaration_claim_proves_declaration_existence_only`
- `validated_symbol_declaration_claims_record_provider_proof_without_raw_body`
- `manifest_dependency_claim_proves_manifest_declaration_only`
- `validated_package_manifest_dependency_claims_persist_after_proofs`
- `package_manifest_dependency_claim_requires_current_manifest_hash_and_scope`
- `observed_test_result_does_not_promote_correctness`
- `source_excerpt_claim_proves_existence_only`
- `project_rule_claim_does_not_resolve_rule_conflict`
- `incompatible_supersedes_edge_does_not_block_claim`
- `incompatible_supersedes_edge_does_not_resolve_contradiction`
- `disjoint_contradiction_scope_does_not_block_claim`
- `claim_edge_authority_required_for_blocking_supersession`
- `legacy_contradiction_edge_blocks_with_warning`
- `review_metadata_edge_cannot_block_current_valid_claim`
- `manual_resolution_edge_requires_user_confirmation_authority`
- `semantic_candidate_cannot_create_claim`
- `semantic_candidates_generated_for_task_input`
- `semantic_candidates_reorder_ranked_refs_only`
- `semantic_candidates_not_persisted_as_durable_claims`
- `semantic_candidate_advisory_wording_avoids_forbidden_phrases`
- `task_retrieval_section_labels_semantic_candidates_advisory`
- `graph_expansion_cannot_satisfy_claim_policy`
- `summary_or_compression_artifact_cannot_satisfy_claim_policy`
- `forbidden_trust_wording_detected_in_overclaim_phrases`
- `durable_claim_generators_avoid_forbidden_root_cause_wording`
- `active_claims_artifact_section_uses_conservative_scoped_title`
- `mcp_candidate_claim_text_rejects_forbidden_trust_wording`

Artifact and diff:

- `context_artifact_requires_dependency_manifest`
- `context_section_requires_content_hash`
- `high_risk_without_task_exact_context_is_unsafe`
- `high_risk_with_task_exact_context_is_not_unsafe`
- `path_like_test_seed_selects_exact_source_without_runtime_claim`
- `related_test_import_selects_exact_source_without_runtime_claim`
- `monorepo_fixture_renders_related_test_relationship_evidence`
- `task_retrieval_relationships_carry_dependency_refs_without_proofs`
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
- `cli_compile_applies_caller_environment_scope`
- `cli_compile_accepts_caller_feature_flag_scope_without_exposing_flag_labels`
- `cli_compile_rejects_unsafe_feature_flag_scope_input`
- `cli_compile_renders_same_file_symbol_claims_only_when_covered_by_current_exact_evidence`
- `cli_compile_renders_package_manifest_dependency_claims_without_raw_manifest_specifiers`
- `mcp_get_context_accepts_caller_feature_flag_scope_without_exposing_flag_labels`
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
- `cli_observed_test_run_records_explicit_test_file_refs`
- `observed_test_failure_span_link_policy_rejects_root_cause_overclaim`
- `failed_observed_test_run_promotes_candidate_span_link_claim_with_hash_only_failure_output`
- `cli_observed_failing_test_links_candidate_spans_without_raw_failure_logs`
- `cli_init_repairs_unusable_local_database`
- `cli_compile_repairs_unusable_local_database`

Storage and security:

- `migration_applies_from_empty_database`
- `migration_checksums_are_recorded`
- `wal_mode_and_busy_timeout_configured`
- `session_lock_survives_process_boundary`
- `ignored_file_not_indexed_without_approval`
- `unsupported_language_gets_safe_lexical_fallback_with_warning`
- `generic_text_fallback_detects_common_language_symbols`
- `polyglot_repo_reports_provider_capability_gaps`
- `monorepo_retrieval_preserves_package_boundaries`
- `task_source_retrieval_reports_related_test_relationships`
- `task_source_retrieval_carries_relationship_refs`
- `task_source_retrieval_scopes_broad_matches_when_package_test_seed_is_exact_input`
- `package_manifest_change_invalidates_package_scoped_context`
- `raw_env_value_not_in_artifact`
- `redacted_display_hash_not_used_as_proof`
- `path_normalization_handles_windows_separators`
- `package_dry_run_contains_cli_and_migrations`
- `claim_edge_authority_migration_applies_from_previous_schema`
- `claim_edge_repository_persists_authority_metadata`

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
