# Beta Transport/Schema Stability Boundary

This document defines which CLI commands, MCP tools, and response fields are stable for the 1.0 beta, which are experimental or inspection-oriented, and which are internal or debug-only. Beta clients should depend only on stable fields and must not branch on undocumented strings.

The stability boundary is enforced through TypeScript types, this document, and focused contract tests in `tests/behavior/contracts/beta-transport-contract.test.mjs`. No standalone output JSON Schema artifact is required for the controlled 1.0 beta.

## Compatibility Rules

- **Additive fields** are permitted when beta clients can safely ignore unknown response keys.
- **Breaking changes**: field removals, renames, or type changes to stable fields require a version bump before release.
- **Machine-readable warnings** are only stable when listed in the warning taxonomy below. Undocumented warning strings are human-readable debug output; beta clients must not branch on them.
- **Default output mode** is `agent_pack`. This is the agent-facing compact contract. `outputMode: "full"` is for inspection only.
- **Beta clients** should key off versioned fields (`artifactFormatVersion`, `graphFormat`) rather than prose or comment strings.
- **Internal and debug fields** must not be required for normal agent operation.

## Stable Beta Surfaces

### CLI commands

| Command | Status |
|---------|--------|
| `grape init --connect` | Stable |
| `grape compile` | Stable |
| `grape status` | Stable |
| `grape diff-context` | Stable |
| `grape diff-context --explain` | Stable |
| `grape artifacts` | Stable |
| `grape restore` | Stable |
| `grape claims` | Stable |
| `grape proofs` | Stable |
| `grape rules` | Stable |
| `grape mcp --stdio --repo <path>` | Stable |

### MCP tools

| Tool | Status |
|------|--------|
| `grape_get_context` | Stable: primary agent entry point |
| `grape_get_artifact` | Stable: inspection and restore path |
| `grape_get_omitted_item` | Stable: restore omitted context |
| `grape_get_stale_items` | Stable: invalidation inspection |
| `grape_get_claims` | Stable: durable claim inspection |
| `grape_get_proofs` | Stable: proof inspection |
| `grape_get_rules` | Stable: active rule inspection |
| `grape_get_conflicts` | Stable: conflict inspection |
| `grape_get_status` | Stable: health check |
| `grape_record_candidate` | Stable: restricted write, records temporary evidence only |
| `grape_record_test_result` | Stable: restricted write |
| `grape_record_command_result` | Stable: restricted write |
| `grape_record_user_decision` | Stable: restricted write |
| `grape_request_user_confirmation` | Stable: restricted write |

### `grape_get_context` request fields

| Field | Status | Notes |
|-------|--------|-------|
| `query` | **Stable** | Required. Non-empty task query string. |
| `sessionId` | **Stable** | One of `sessionId` or `agentSessionId` required for session tracking. |
| `agentSessionId` | Accepted advisory | Optional alias for `sessionId`. Identity is not persisted in compile output. Not required for beta clients. |
| `agentName` | Accepted advisory | Optional metadata. Not persisted in compile output. Not required for beta clients. |
| `taskType` | **Stable** | Optional. One of `bug_fix`, `security_fix`, `refactor`, `migration`, `feature`, `test_repair`, `analysis`. Defaults to `analysis`. |
| `files` | **Stable** | Optional explicit source file seeds. |
| `symbols` | **Stable** | Optional symbol seeds. |
| `tests` | **Stable** | Optional test file seeds. |
| `tokenBudget` | **Stable** | Optional positive integer. |
| `resetSession` | **Stable** | Optional boolean. Forces a full resend for the current session. |
| `outputMode` | **Stable** | Optional. `agent_pack` (default) or `full` (inspection only). |
| `environmentScope` | **Stable** | Optional. One of `local`, `test`, `ci`, `staging`, `production`, `unknown`. |
| `featureFlags` | **Stable** | Optional. Allowlisted keys only. Values are count/hash-only in compact output. |

### `grape_get_context` response fields

| Field | Status | Notes |
|-------|--------|-------|
| `artifactId` | **Stable** | Non-empty string. |
| `artifactHash` | **Stable** | Non-empty string. |
| `dependencyManifestHash` | **Stable** | Non-empty string. |
| `sessionId` | **Stable** | Non-empty string. |
| `branch` | **Stable** | Non-empty string. |
| `headCommit` | **Stable** | Non-empty string. |
| `dirtyWorktree` | **Stable** | Boolean. |
| `taskType` | **Stable** | String. |
| `riskOverlays` | **Stable** | Array of strings; may be empty. |
| `compileMode` | **Stable** | One of `safe_minimum`, `partial_with_risk`, `cannot_compile_safely`. `broad_context_required` is reserved for forward compatibility but is not currently emitted; beta clients may ignore it. Debug-only warnings do not change this field. |
| `outputMode` | **Stable** | `agent_pack` or `full`. Defaults to `agent_pack`. |
| `artifactRef` | **Stable** | Object. See `AgentContextArtifactRef` below. |
| `contextPackItems` | **Stable** | Array of compact `AgentContextPackItem` objects in `agent_pack` mode. |
| `contextPackMarkdown` | Inspection-oriented / optional | String when present. Compact navigation summary for CLI parity and human inspection. Agents should prefer `contextPackItems` and `artifactRef`. Not required for compact-agent operation. |
| `diffSummary` | **Stable** | Object with counts for all diff states (`NEW`, `CHANGED`, `PINNED`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, `RESTORE_AVAILABLE`). |
| `warnings` | **Stable (array shape)** | Array of strings; may be empty. Machine-readable only for codes listed in the warning taxonomy below. Default `agent_pack` filters debug-only warning strings. Full inspection output may include them. |
| `unsafeReasons` | **Stable** | Array of strings; may be empty on safe compile. See taxonomy below. |
| `budget` | **Stable** | Object with `status` field and optional numeric fields; see budget shape below. |
| `restoreAvailable` | **Stable** | Boolean. `false` on first turn is expected. |
| `artifactFiles` | **Stable** | Object with `json` and `markdown` repo-relative paths. |
| `currentScope` | **Stable** | Object with scope fields; see below. |
| `agentGraph` | Experimental | Optional transport adjacency graph. Shape may refine before 1.0. Beta clients must not require this field. |
| `recoveryGuidance` | Experimental | Optional human-readable guidance array. Beta clients must not branch on prose content. |
| `contextArtifact` | Inspection only | Embedded full artifact present only in `outputMode: "full"`. Not part of compact-agent contract. |
| `sessionResetId` | **Stable (conditional)** | Present only when a session reset occurred. |

### `AgentContextArtifactRef`

| Field | Status |
|-------|--------|
| `artifactId` | **Stable** |
| `artifactHash` | **Stable** |
| `dependencyManifestHash` | **Stable** |
| `artifactFiles.json` | **Stable** |
| `artifactFiles.markdown` | **Stable** |
| `fullArtifactTool.name` | **Stable**: always `grape_get_artifact` |
| `fullArtifactTool.arguments.artifactId` | **Stable** |
| `fullArtifactTool.arguments.outputMode` | **Stable**: `full` |

### `AgentContextPackItem` (compact `agent_pack` shape)

| Field | Status | Notes |
|-------|--------|-------|
| `id` | **Stable** | String. |
| `state` | **Stable** | One of `NEW`, `CHANGED`, `PINNED`, `OMIT_UNCHANGED`, `INVALIDATE_PREVIOUS`, `RESTORE_AVAILABLE`. |
| `itemKind` | **Stable** | Documented item kind string. |
| `itemRef` | **Stable** | String. |
| `title` | **Stable** | String. |
| `contentPreview` | **Stable** | String. Whitespace-normalized excerpt, max 280 chars. |
| `contentOmitted` | **Stable** | Always `true` in `agent_pack` mode. |
| `contentHash` | **Stable** | String. |
| `tokenCount` | **Stable** | Number. |
| `pinned` | **Stable** | Boolean. |
| `safetyCritical` | **Stable** | Boolean. |
| `content` | **Not present in `agent_pack`** | Omitted. Available only in `outputMode: "full"`. |
| `inputRefs` | **Stable** | Array of compact input ref objects with local routing keys only (no `repoId`, `taskId`, `sessionId`). |
| `warnings` | **Stable (array shape)** | Array; may be empty. |
| `sectionId` | **Stable (optional)** | String when present. |
| `invalidatesSentItemId` | **Stable (optional)** | String for `INVALIDATE_PREVIOUS` items. |
| `restoreId` | **Stable (optional)** | String for `RESTORE_AVAILABLE` items. |

### Budget shape

| Field | Status | Notes |
|-------|--------|-------|
| `status` | **Stable** | One of `not_requested`, `within_budget`, `over_budget`, `required_context_exceeds_budget`. |
| `tokenBudget` | **Stable (optional)** | Null or absent when status is `not_requested`. |
| `estimatedPackTokens` | **Stable (optional)** | Null or absent when not computed. |
| `requiredContextTokens` | **Stable (optional)** | |
| `omittedDueToBudget` | **Stable (optional)** | Array of omitted item descriptors when budget is active. |
| `warnings` | **Stable (array shape)** | |
| `unsafeReasons` | **Stable (array shape)** | |

### Current scope shape

`currentScope` contains routing and session state. Compact output includes:
`branch`, `commit`, `worktreeHash`, `dirtyWorktree`, `taskId`, `sessionId`, `environment`, `featureFlagCount`, optional `packageRoot`, `serviceRoot`, `featureFlagScopeHash`, `sourceRefs`, `warnings`. Raw `featureFlags` are never exposed in public output.

### Diff states

These six state values are stable:

- `NEW`: context not previously sent this session.
- `CHANGED`: previously sent, hash changed.
- `PINNED`: always re-sent regardless of change.
- `OMIT_UNCHANGED`: previously sent and unchanged; omitted this turn.
- `INVALIDATE_PREVIOUS`: a prior sent item is now stale or contradicted.
- `RESTORE_AVAILABLE`: a prior omitted item is available to restore on request.

### Stored artifact envelope

Fields stable in the stored `.grape/artifacts/*.json` file:

| Field | Status |
|-------|--------|
| `artifactFormat` | **Stable**: `grape.context-pack.v1` |
| `artifactFormatVersion` | **Stable**: `1` |
| `contextPackItemShape` | **Stable**: `ContextPackItem` |
| `contextPackItems` | **Stable** |
| `contextArtifact` | **Stable** |
| `omittedItems` | **Stable** |
| `tokenMetric` | **Stable (optional)** |
| `budget` | **Stable (optional)** |

`agentGraph` transport shape: `graphFormat: "grape.agent-context-graph.v1"` is experimental and may refine before 1.0.

### Restore tokens

`RESTORE_AVAILABLE` items expose a `restoreId` that can be passed to `grape_get_omitted_item`. Restore tokens are session-scoped and validate against the current dependency manifest hash. Tokens referencing a stale dependency manifest are rejected with `restore_token_rejects_stale_dependency`.

### Proof and claim summaries

Claims, proofs, and rules returned by `grape_get_claims`, `grape_get_proofs`, and `grape_get_rules` do not include raw excerpt bodies or absolute repository paths. These read tools return metadata shapes only. The stability boundaries for each tool's response shape are defined in `mcp-tools.md`.

## Experimental Surfaces

These surfaces are implemented and tested but may change shape before stable 1.0:

- `agentGraph`: adjacency graph over context-pack items. The `graphFormat` version string will bump if the node/edge schema changes. Beta clients must not require this field.
- `recoveryGuidance`: human-readable array of recovery suggestions. Content is advisory; beta clients must not parse or branch on prose.
- `contextPackMarkdown`: inspection-oriented Markdown navigation summary. Agents should prefer structured `contextPackItems` and `artifactRef` for reliable extraction.

## Accepted Advisory Surfaces

These surfaces are accepted for caller metadata and session compatibility, but are not persisted as independent compiled artifact fields:

- `agentName`: accepted in request; not persisted; not reflected in compile output.
- `agentSessionId`: accepted as an alias for `sessionId` for session tracking. Identity is not independently tracked in compile output. Full inspection output may include a debug-only advisory warning.

## Reserved / Legacy-Compatible

- `compileMode: broad_context_required`: enum value retained for forward compatibility. Not currently emitted by any compile path. Beta clients may safely ignore it.

## Internal and Debug-Only

- Undocumented warning strings: any warning code not listed in the taxonomy below is human-readable debug output. Beta clients must not depend on undocumented strings.
- Debug-only warnings are filtered from default `agent_pack` output and do not affect `compileMode`.
- `outputMode: "full"` inline `contextArtifact`: for inspection only; not part of compact-agent contract.
- Internal retrieval and compiler fields: `selectedReasons`, tier partition state, and similar fields never appear in public output.

## Warning Taxonomy

These warning codes and patterns are part of the stable beta contract. Beta clients may treat them as machine-readable.

### Stable warning codes

| Code | Meaning |
|------|---------|
| `task_retrieval_truncated` | More source candidates than the cap; selection was limited. |
| `task_retrieval_omitted_over_cap:<count>` | Parameterized: `<count>` is a numeric integer. This is the number of candidates omitted beyond the cap. |
| `task_retrieval_seed_packages_omitted_over_cap:<count>` | Parameterized: `<count>` is a numeric integer. This is the number of seeded package roots that received no selected source because the cap was exhausted. |
| `task_retrieval_no_source_matches` | No source refs matched the query after retrieval. |
| `task_retrieval_no_related_tests_found` | No related test files were found for the selected implementation sources. |
| `task_seed_file_not_found:<ref>` | An explicit seed file was not found in the current snapshot. |
| `task_seed_test_not_found:<ref>` | An explicit test seed was not found. |
| `task_seed_file_not_found_omitted:<count>` | Parameterized: count of additional missing file seed warnings omitted from compact output. |
| `task_seed_test_not_found_omitted:<count>` | Parameterized: count of additional missing test seed warnings omitted from compact output. |
| `dirty_worktree_context` | Context was compiled against a dirty worktree. Uncommitted changes may not be fully reflected. |
| `risk_overlay_requires_exact_context` | A risk overlay is active; exact source/config/rule evidence is required. |

### Stable unsafe reason codes

| Code | Meaning |
|------|---------|
| `risk_overlay_missing_exact_context` | Risk overlay active but no task-selected source/config/rule excerpt with body-local overlay evidence was found. Compile is unsafe. |
| `token_budget_below_required_context` | Required context exceeds the token budget. |

### Reserved warning prefixes

The following prefixes are reserved. Beta clients must not depend on specific suffix values unless the full code is listed above:

- `current_scope_*`: scope state diagnostics. Specific suffixes may change.
- `repository_artifact_*`: repository index diagnostics. Currently advisory/noisy; classification may change.

### Debug/human-only (not stable)

- `mcp_agent_identity_not_persisted_in_context_compile`: advisory notice for `agentName`/`agentSessionId` use.
- `repository_artifact_uses_lightweight_index`: index quality notice emitted in stored/full artifact warnings when lightweight index is active; filtered from default `agent_pack`.
- Any warning code not listed in the stable table above.
