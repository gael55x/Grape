# V1 MCP Tools

## Purpose

Define MCP tool contracts and safety boundaries.

## Source Of Truth

Tool schemas and safety rules are derived from `docs/v1/SPEC.md`.

## Update Triggers

- a tool is added, removed, or changed
- tool input/output changes
- write safety behavior changes

## Agent Checks

Before editing MCP behavior, agents must verify:

- MCP tools are adapters, not core logic
- write tools record evidence only
- write tools cannot promote durable truth directly
- ignored/private file policy is respected

## Required V1 Tools

Read tools:

- `grape_get_context`
- `grape_get_claims`
- `grape_get_proofs`
- `grape_get_rules`
- `grape_get_omitted_item`
- `grape_get_artifact`
- `grape_get_stale_items`
- `grape_get_conflicts`
- `grape_get_status`

Restricted write tools:

- `grape_record_candidate`
- `grape_record_test_result`
- `grape_record_command_result`
- `grape_record_user_decision`
- `grape_request_user_confirmation`

## Current Implementation Status

The current implementation includes the first stdio MCP server:

```json
{
  "grapeMcp": {
    "status": "implemented",
    "implemented": true,
    "serverName": "grape",
    "command": "grape",
    "args": ["mcp", "--stdio", "--repo", "<repo-root>"],
    "cwd": "<repo-root>",
    "transport": "stdio",
    "tools": [
      "grape_get_context",
      "grape_get_artifact",
      "grape_get_claims",
      "grape_get_proofs",
      "grape_get_rules",
      "grape_get_omitted_item",
      "grape_get_stale_items",
      "grape_get_conflicts",
      "grape_get_status",
      "grape_record_candidate",
      "grape_record_command_result",
      "grape_record_test_result",
      "grape_record_user_decision",
      "grape_request_user_confirmation"
    ],
    "note": "Run grape mcp --stdio --repo <repo-root> to serve Grape context over MCP stdio."
  }
}
```

`grape mcp --stdio` implements framed JSON-RPC stdio handling for `initialize`, `tools/list`, `tools/call`, and `ping`. The implemented Grape tools are:

- `grape_get_context`
- `grape_get_artifact`
- `grape_get_claims`
- `grape_get_proofs`
- `grape_get_rules`
- `grape_get_omitted_item`
- `grape_get_stale_items`
- `grape_get_conflicts`
- `grape_get_status`
- `grape_record_candidate`
- `grape_record_command_result`
- `grape_record_test_result`
- `grape_record_user_decision`
- `grape_request_user_confirmation`

`grape_get_context` calls the same local-project compile service used by `grape compile --task <text>`. It auto-bootstraps local `.grape/` state when needed, captures the current repo snapshot, persists source/index inputs, resolves task source hints from lexical task terms plus `files`, `symbols`, and `tests` seed refs, persists deterministic `symbol_outline` and `rule_digest` compression cache records before compilation, compiles a repository-derived scaffold artifact with pinned active project rules, non-proof compression orientation, and bounded exact-source evidence prioritized toward selected allowed sources, projects it to the public V1 `ContextArtifact` shape, persists session diff rows, persists a deterministic `context_pack_summary` from the current sent ledger, writes JSON/Markdown artifacts under `.grape/artifacts/`, and returns structured context-pack items plus rendered Markdown.

When the same MCP session identity is reused after a Git branch switch for the same task, the compile service updates the session's branch/head metadata under the session lock, records a `branch_changed` session invalidation event, and returns `INVALIDATE_PREVIOUS` items for stale branch-scoped context instead of `OMIT_UNCHANGED` items from the previous branch.

When `resetSession: true` is supplied for an existing MCP session, the compile service records a `session_reset` invalidation event, returns `INVALIDATE_PREVIOUS` items for active prior sent context, and forces full resend of current scaffold artifact sections instead of omitting unchanged sections.

Current limitation: the returned `contextArtifact` and public artifact JSON use the V1 `ContextArtifact` envelope, but their sections are still projected from the repository-derived scaffold rather than final durable current-valid claim retrieval. The current implementation requires `sessionId` or `agentSessionId` so session-scoped diffing cannot collapse across independent agents. Seed `files`, `symbols`, and `tests` participate in risk-overlay detection and source retrieval, but retrieval is still a conservative source-selection foundation over allowed snapshot records. `symbol_outline` and `rule_digest` compression are deterministic cache/orientation only; `context_pack_summary` is persisted as cache but not rendered into artifacts yet. Stale compression invalidation events and pruning remain pending. `tokenBudget` is evaluated without pruning pinned, exact, or invalidation context; if required context exceeds the budget, `compileMode` is `cannot_compile_safely`. Non-local `environmentScope`, `agentName`, `agentSessionId`, and `resetSession` are accepted for contract compatibility; unsupported environment behavior produces explicit warnings and `compileMode: "partial_with_risk"` unless a stronger unsafe condition applies. Detected risk overlays return `compileMode: "cannot_compile_safely"` with `risk_overlay_missing_exact_context` unless task retrieval or explicit seed refs select proof-backed exact source/config/rule evidence. Artifact file refs returned over MCP are repo-relative paths, not absolute local paths.

Unsafe or risky context outputs include `recoveryGuidance` so MCP consumers can decide whether to request narrower file/symbol/test seed refs, increase a token budget, rerun after worktree cleanup, or inspect local state without guessing from internal errors.

`grape_get_artifact` returns stored artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public artifact file refs for one `artifactId`. It does not return raw scaffold sidecar bodies. MCP output omits absolute local root paths.

`grape_get_claims` returns current-valid durable claim metadata, defaulting to `activeOnly: true`. Current V1 implementation exposes only the narrow `repository_source_excerpt_exists` claim type created from validated exact-source proof rows. It returns claim IDs, subjects, claim text, scope metadata, proof refs, source refs, and current-valid rejection counts. It does not return raw proof excerpts, source file bodies, or absolute local root paths.

`grape_get_proofs` returns persisted proof row metadata, optionally filtered by `proofId` or `sourceId`. It returns proof IDs, source IDs/refs, proof type, support status, source hashes, excerpt hashes, and optional claim IDs. It does not return raw proof excerpts or source file bodies. MCP output omits absolute local root paths.

`grape_get_rules` returns current Git-visible project rule excerpts after source-hash verification and the artifact secret scan. It uses the same rule-file classification as repository snapshots and removes `rootPath` from MCP output. Current V1 behavior returns hash-verified excerpts and deterministic proof IDs; parsed durable `project_rules`, nested scope resolution, candidate/generated rules, and rule conflict handling remain pending.

`grape_get_omitted_item` restores one omitted context item by `sessionId` and `restoreToken`. It validates the token against the session, stored scaffold artifact metadata, stored dependency rows, artifact hash, section content hash, dependency manifest, redaction status, branch, head commit, worktree hash, source/config/lockfile/rule dependency hashes, and proof dependency rows/hashes before returning the omitted body. Stale restore attempts return `status: "stale"` with an error result rather than returning stale content. MCP output omits absolute local root paths.

`grape_get_stale_items` returns emitted stale-context invalidation metadata, optionally filtered by `sessionId`. It reuses the same local app service as `grape stale`, removes `rootPath` from MCP output, and does not return context bodies.

`grape_get_conflicts` returns recorded claim conflict edges from `claim_edges`, including `contradicts`, `needs_review`, `violates`, and `unknown_scope_overlap`, without attempting to resolve or merge claims. It reuses the same app service as `grape conflicts` and removes `rootPath` from MCP output.

`grape_get_status` returns local bootstrap, migration, and Git-state diagnostics including `recoveryGuidance` for missing config/database, pending migrations, root mismatch, dirty worktree scope, or missing Git metadata.

`grape_record_command_result` and `grape_record_test_result` persist agent-reported command/test observations as temporary `command_run` / `test_run` source evidence rows scoped to the current repo snapshot and an existing current context session. The adapter accepts the raw command only to verify `commandHash`; raw command, stdout, and stderr bodies are not persisted or returned. MCP callers cannot mint `observedRunId`, cannot self-declare `observedByGrape`, and cannot promote these rows to durable claims or proofs.

`grape_record_candidate` persists an agent-reported claim candidate as a non-durable `claim_candidates` row and links it to a temporary `assistant_response` source when the caller does not provide an existing current source. It returns candidate/source IDs only, not the raw claim text, and cannot promote the candidate to a durable claim.

`grape_record_user_decision` persists direct-confirmation metadata as a temporary redacted `user_message` source row. The adapter accepts raw prompt/response text only to verify `promptHash` and `responseHash`; raw prompt and response bodies are not persisted or returned.

`grape_request_user_confirmation` returns a deterministic non-durable confirmation request ID for a prompt hash and scope. It does not persist durable truth and tells the caller to collect direct user confirmation before calling `grape_record_user_decision`.

The V1 MCP surface is now implemented as a local-first foundation. Remaining work is hardening final durable current-valid retrieval, broader proof types, and future Grape-observed command/test runners without allowing MCP writes to promote truth directly.

## Read Tool Contract

```ts
interface GrapeGetContextInput {
  query: string;
  taskType?: Exclude<TaskType, "bootstrap">;
  files?: string[];
  symbols?: string[];
  tests?: string[];
  environmentScope?: "local" | "test" | "ci" | "staging" | "production" | "unknown";
  tokenBudget?: number; // positive integer
  sessionId?: string;
  agentName?: string;
  agentSessionId?: string;
  resetSession?: boolean;
}

interface GrapeGetContextOutput {
  artifactId: string;
  artifactHash: string;
  dependencyManifestHash: string;
  sessionId: string;
  branch: string;
  headCommit: string;
  dirtyWorktree: boolean;
  taskType: TaskType;
  riskOverlays: RiskOverlay[];
  compileMode: CompileMode;
  contextArtifact: ContextArtifact;
  contextPackItems: ContextPackItem[];
  contextPackMarkdown: string;
  diffSummary: {
    newItems: number;
    changedItems: number;
    pinnedItems: number;
    omittedItems: number;
    invalidatedItems: number;
    restoreAvailableItems: number;
  };
  warnings: string[];
  unsafeReasons: string[];
  recoveryGuidance: string[];
  budget: {
    status: "not_requested" | "within_budget" | "over_budget" | "required_context_exceeds_budget";
    tokenBudget?: number;
    estimatedPackTokens: number;
    requiredContextTokens: number;
    warnings: string[];
    unsafeReasons: string[];
  };
  sessionResetId?: string;
  restoreAvailable: boolean;
  artifactFiles: {
    json: string;
    markdown: string;
  };
}
```

```ts
interface GrapeGetOmittedItemInput {
  sessionId: string;
  restoreToken: string;
}

type GrapeGetOmittedItemOutput =
  | {
      status: "restored";
      sessionId: string;
      restoreToken: string;
      artifactId: string;
      sectionId: string;
      title: string;
      body: string;
      contentHash: string;
      warnings: string[];
    }
  | {
      status: "stale";
      sessionId: string;
      restoreToken: string;
      artifactId: string;
      sectionId: string;
      reason: string;
      warnings: string[];
    };
```

```ts
interface GrapeGetArtifactInput {
  artifactId: string;
}

interface GrapeGetArtifactOutput {
  artifactId: string;
  sessionId: string;
  taskType: string;
  riskOverlays: string[];
  artifactHash: string;
  dependencyManifestHash: string;
  warnings: string[];
  unsafeReasons: string[];
  createdAt: string;
  artifactFiles: {
    json: string;
    markdown: string;
    jsonExists: boolean;
    markdownExists: boolean;
  };
  dependencies: Array<{
    dependencyId: string;
    kind: string;
    ref: string;
    hash: string;
    scope: Record<string, unknown>;
  }>;
}
```

```ts
interface GrapeGetProofsInput {
  proofId?: string;
  sourceId?: string;
}

interface GrapeGetProofsOutput {
  filter: {
    proofId?: string;
    sourceId?: string;
  };
  proofs: Array<{
    proofId: string;
    claimId?: string;
    sourceId: string;
    sourceType?: string;
    sourceRef?: string;
    sourceScope?: string;
    proofType: string;
    sourceHash: string;
    excerptHash: string;
    supportStatus: string;
    privacyStatus?: string;
    redactionStatus?: string;
    createdAt: string;
  }>;
}
```

```ts
interface GrapeGetRulesInput {}

interface GrapeGetRulesOutput {
  branch: string;
  headCommit: string;
  dirtyWorktree: boolean;
  rules: Array<{
    sourceId: string;
    sourceRef: string;
    sourceHash: string;
    sourceScope: string;
    proofId: string;
    excerptHash: string;
    startLine: number;
    endLine: number;
    truncated: boolean;
    body: string;
  }>;
  rejectedRuleRefs: string[];
  warnings: string[];
}
```

```ts
interface GrapeGetStaleItemsInput {
  sessionId?: string;
}

interface GrapeGetStaleItemsOutput {
  sessionId?: string;
  inspectedSessionCount: number;
  staleItems: Array<{
    staleItemId: string;
    sessionId: string;
    artifactId: string;
    sectionId?: string;
    itemKind: string;
    itemRef: string;
    invalidatesSentItemId: string;
    staleReason: "branch_changed" | "session_reset" | "dependency_manifest_changed";
    previousArtifactId?: string;
    previousSectionId?: string;
    previousBranchName?: string;
    previousCommitSha?: string;
    dependencyRefs: string[];
    createdAt: string;
  }>;
}
```

```ts
interface GrapeGetConflictsInput {}

interface GrapeGetConflictsOutput {
  branch: string;
  headCommit: string;
  dirtyWorktree: boolean;
  conflicts: Array<{
    edgeId: string;
    edgeType: "contradicts" | "needs_review" | "violates" | "unknown_scope_overlap";
    sourceClaimId: string;
    targetClaimId: string;
    sourceClaim?: {
      claimId: string;
      subject: string;
      claimType: string;
      claimText: string;
      verificationStatus: string;
      scopeHash: string;
    };
    targetClaim?: {
      claimId: string;
      subject: string;
      claimType: string;
      claimText: string;
      verificationStatus: string;
      scopeHash: string;
    };
    createdAt: string;
  }>;
  warnings: string[];
}
```

Rules:

- `contextPackItems` is canonical. Markdown is only a rendering.
- `compileMode` carries `safe_minimum`, `partial_with_risk`, `broad_context_required`, or `cannot_compile_safely` semantics from the compiler.
- `cannot_compile_safely` must not return unsafe context as if it were safe.
- `partial_with_risk` must include explicit warnings and missing-context reasons.
- Read tools must never silently read ignored/private files.
- The current implementation returns V1-shaped `ContextPackItem[]` while the compiled artifact schema itself remains the documented scaffold shape.

## Restricted Write Contracts

Write tools record evidence candidates or request direct confirmation. They cannot promote durable truth directly.

```ts
interface GrapeRecordCandidateInput {
  sessionId: string;
  subject: string;
  claimType: string;
  claimText: string;
  scope: Record<string, unknown>;
  sourceId?: string;
  reportedBy: "agent";
}

interface GrapeRecordCandidateOutput {
  candidateId: string;
  sourceId: string;
  sourceType: string;
  durable: false;
  promoted: false;
  inserted: boolean;
  evidenceInserted: boolean;
  warnings: string[];
}

interface GrapeRecordCommandResultInput {
  sessionId: string;
  command: string;
  commandHash: string;
  cwd: string;
  exitCode: number;
  stdoutHash: string;
  stderrHash: string;
  startedAt: string;
  endedAt: string;
  reportedBy?: "agent";
}

interface GrapeRecordTestResultInput extends GrapeRecordCommandResultInput {
  testFramework?: string;
  testFiles?: string[];
  passed: boolean;
}

interface GrapeRecordObservationOutput {
  evidenceId: string;
  sourceId: string;
  sourceType: "command_run" | "test_run";
  sourceRef: string;
  sourceHash: string;
  trustClass: "temporary";
  durable: false;
  observedBy: "agent_reported";
  inserted: boolean;
  redactedFields: Array<"command" | "stdout" | "stderr">;
  warnings: string[];
}

interface GrapeRecordUserDecisionInput {
  sessionId: string;
  prompt: string;
  promptHash: string;
  response: string;
  responseHash: string;
  confirmationChannel: "cli_prompt" | "mcp_user_confirmation" | "config_file" | "rule_file";
  confirmedByUser: boolean;
  confirmedAt: string;
  scope: Record<string, unknown>;
  reportedBy: "agent";
}

interface GrapeRecordUserDecisionOutput {
  evidenceId: string;
  sourceId: string;
  sourceType: "user_message";
  sourceRef: string;
  sourceHash: string;
  durable: false;
  observedBy: "agent_reported_user_decision";
  inserted: boolean;
  redactedFields: Array<"prompt" | "response">;
  warnings: string[];
}

interface GrapeRequestUserConfirmationInput {
  sessionId: string;
  prompt: string;
  promptHash: string;
  scope: Record<string, unknown>;
  reason?: string;
  reportedBy: "agent";
}

interface GrapeRequestUserConfirmationOutput {
  confirmationRequestId: string;
  status: "requires_user_confirmation";
  promptHash: string;
  scope: Record<string, unknown>;
  durable: false;
  warnings: string[];
  recoveryGuidance: string[];
}
```

Write rules:

- MCP candidate writes create or link temporary evidence and persist only non-durable candidate rows.
- MCP command/test write tools are agent-reported by definition and remain temporary scratch evidence in `sources`.
- MCP callers cannot self-declare Grape-observed authority or mint `observedRunId`.
- MCP write tools require an existing current context session, so callers should call `grape_get_context` first.
- Raw command, stdout, stderr, prompt, and response bodies are not persisted or returned; only hashes and scoped metadata are stored.
- Only a local Grape command runner may create Grape-observed command/test evidence with an observed run ID.
- A Grape-observed run must include command hash, cwd, exit code, stdout/stderr hashes, and timestamps, and it must be created outside the MCP adapter.
- User decisions require direct confirmation with prompt hash, response hash, timestamp, and confirmation channel.
- Write tools return evidence IDs or candidate IDs only. They do not return claim IDs for newly durable claims.
- Promotion, if later allowed, must replay Trust Kernel gates outside the MCP adapter.

## Contract Tests

- `mcp_get_context_returns_structured_items`
- `mcp_get_context_markdown_matches_items`
- `mcp_write_tool_cannot_promote_claim`
- `agent_reported_test_result_is_temporary`
- `grape_observed_run_requires_command_and_output_hashes`
- `user_decision_requires_direct_confirmation_hashes`
- `ignored_file_read_requires_approval`
- `unsafe_compile_does_not_return_safe_status`
