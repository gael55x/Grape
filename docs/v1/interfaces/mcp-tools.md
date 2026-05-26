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
      "grape_get_proofs",
      "grape_get_omitted_item",
      "grape_get_status"
    ],
    "note": "Run grape mcp --stdio --repo <repo-root> to serve Grape context over MCP stdio."
  }
}
```

`grape mcp --stdio` implements framed JSON-RPC stdio handling for `initialize`, `tools/list`, `tools/call`, and `ping`. The implemented Grape tools are:

- `grape_get_context`
- `grape_get_artifact`
- `grape_get_proofs`
- `grape_get_omitted_item`
- `grape_get_status`

`grape_get_context` calls the same local-project compile service used by `grape compile --task <text>`. It auto-bootstraps local `.grape/` state when needed, captures the current repo snapshot, persists source/index inputs, resolves task source hints from lexical task terms plus `files`, `symbols`, and `tests` seed refs, compiles a repository-derived scaffold artifact with pinned active project rules and bounded exact-source evidence prioritized toward selected allowed sources, projects it to the public V1 `ContextArtifact` shape, persists session diff rows, writes JSON/Markdown artifacts under `.grape/artifacts/`, and returns structured context-pack items plus rendered Markdown.

When the same MCP session identity is reused after a Git branch switch for the same task, the compile service updates the session's branch/head metadata under the session lock, records a `branch_changed` session invalidation event, and returns `INVALIDATE_PREVIOUS` items for stale branch-scoped context instead of `OMIT_UNCHANGED` items from the previous branch.

When `resetSession: true` is supplied for an existing MCP session, the compile service records a `session_reset` invalidation event, returns `INVALIDATE_PREVIOUS` items for active prior sent context, and forces full resend of current scaffold artifact sections instead of omitting unchanged sections.

Current limitation: the returned `contextArtifact` and public artifact JSON use the V1 `ContextArtifact` envelope, but their sections are still projected from the repository-derived scaffold rather than final durable current-valid claim retrieval. The current implementation requires `sessionId` or `agentSessionId` so session-scoped diffing cannot collapse across independent agents. Seed `files`, `symbols`, and `tests` participate in risk-overlay detection and source retrieval, but retrieval is still a conservative source-selection foundation over allowed snapshot records. `tokenBudget` is evaluated without pruning pinned, exact, or invalidation context; if required context exceeds the budget, `compileMode` is `cannot_compile_safely`. Non-local `environmentScope`, `agentName`, `agentSessionId`, and `resetSession` are accepted for contract compatibility; unsupported environment behavior produces explicit warnings and `compileMode: "partial_with_risk"` unless a stronger unsafe condition applies. Detected risk overlays return `compileMode: "cannot_compile_safely"` with `risk_overlay_missing_exact_context` unless task retrieval or explicit seed refs select proof-backed exact source/config/rule evidence. Artifact file refs returned over MCP are repo-relative paths, not absolute local paths.

`grape_get_artifact` returns stored artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public artifact file refs for one `artifactId`. It does not return raw scaffold sidecar bodies. MCP output omits absolute local root paths.

`grape_get_claims` returns current-valid durable claim metadata, defaulting to `activeOnly: true`. Current V1 implementation exposes only the narrow `repository_source_excerpt_exists` claim type created from validated exact-source proof rows. It returns claim IDs, subjects, claim text, scope metadata, proof refs, source refs, and current-valid rejection counts. It does not return raw proof excerpts, source file bodies, or absolute local root paths.

`grape_get_proofs` returns persisted proof row metadata, optionally filtered by `proofId` or `sourceId`. It returns proof IDs, source IDs/refs, proof type, support status, source hashes, excerpt hashes, and optional claim IDs. It does not return raw proof excerpts or source file bodies. MCP output omits absolute local root paths.

`grape_get_omitted_item` restores one omitted context item by `sessionId` and `restoreToken`. It validates the token against the session, stored scaffold artifact metadata, stored dependency rows, artifact hash, section content hash, dependency manifest, redaction status, branch, head commit, worktree hash, source/config/lockfile/rule dependency hashes, and proof dependency rows/hashes before returning the omitted body. Stale restore attempts return `status: "stale"` with an error result rather than returning stale content. MCP output omits absolute local root paths.

The remaining V1 read tools and restricted write tools are still pending. They must reuse app services and storage/trust modules rather than embedding business logic in the MCP adapter.

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
interface GrapeRecordCommandResultInput {
  repoPath: string;
  sessionId: string;
  command: string;
  commandHash: string;
  cwd: string;
  exitCode: number;
  stdoutHash: string;
  stderrHash: string;
  startedAt: string;
  endedAt: string;
  reportedBy: "agent";
}

interface GrapeRecordTestResultInput extends GrapeRecordCommandResultInput {
  testFramework?: string;
  testFiles?: string[];
  passed: boolean;
}

interface GrapeRecordUserDecisionInput {
  repoPath: string;
  sessionId: string;
  subject: string;
  promptHash: string;
  responseHash: string;
  confirmationChannel: "cli" | "mcp_prompt" | "local_ui";
  confirmedAt: string;
  recordedBy: "direct_user_confirmation";
}
```

Write rules:

- MCP command/test write tools are agent-reported by definition and remain temporary scratch evidence.
- MCP callers cannot self-declare Grape-observed authority or mint `observedRunId`.
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
