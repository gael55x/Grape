# V1 MCP Tools

## Purpose

Define MCP tool contracts and safety boundaries.

## Reviewer Note: Artifact Vs Durable Truth

`grape_get_context` returns compact preview-shaped `contextPackItems` plus compact `agent_pack` transport by default. The stored artifact and optional `outputMode: "full"` response use the V1 `contextArtifact` contract. Compression orientation, lexical retrieval, and narrow source/symbol claims do not replace proof-backed durable truth for the full repository. See `docs/v1/contracts/context-artifact.md`.

## Source Of Truth

Tool schemas and safety rules are derived from `docs/v1/SPEC.md`.

For the beta transport/schema stability boundary, including stable, experimental, and debug fields, warning taxonomy, and compatibility rules, see [`docs/v1/contracts/transport-stability.md`](../contracts/transport-stability.md).

For stable agent session identity, task mismatch recovery, JSON-RPC framing examples, and published-package install troubleshooting, see [`agent-sessions.md`](agent-sessions.md).

## Start Here For Integration

If you only want Grape connected to a coding agent, start here and come back to the schema details later.

The goal is small: let the agent call `grape_get_context` from the repo it is editing, without making you copy JSON by hand.

1. Install Grape and initialize the repo with `grape init --connect`.
2. If you use Cursor and your installed build supports the safe installer, run `grape mcp --install --client cursor`.
3. If you use Claude Desktop and your installed build supports the safe installer, run `grape mcp --install --client claude`.
4. If you use Codex and your installed build supports the safe installer, run `grape mcp --install --client codex`.
5. Make sure the client launches `grape mcp --stdio --repo <repo-root>`.
6. Make sure the client sends one JSON-RPC object per line over stdio.
7. Have the agent call `grape_get_context` with a stable `sessionId` and task `query`.

Cursor auto-install writes project-local `.cursor/mcp.json`. Claude Desktop auto-install writes `claude_desktop_config.json` when Grape can resolve the platform path safely. Codex auto-install writes project-local `.codex/config.toml` for trusted Codex projects.

Grape does not silently touch unsupported client config files. Other clients, and published beta builds that do not recognize `grape mcp --install`, remain on the manual path:

```bash
grape mcp --print-config
```

To add repository guidance for agents, print a path-neutral AGENTS.md snippet:

```bash
grape mcp --print-agents-snippet
```

Review the snippet before adding it to AGENTS.md. Grape does not edit AGENTS.md automatically.

For Codex plugin setup, use the repo-local plugin:

```bash
codex plugin marketplace add .
codex plugin add grape@grape-local
```

Run those commands from the repository root. The plugin lives in `plugins/grape`, exposes `grape mcp --stdio`, and includes the Grape skill. It assumes `grape` is on `PATH`. It does not ship hooks. Use `grape mcp --install --client codex` when the project needs `.codex/config.toml` with an exact working directory.

Run `npm run build` and `npm run codex:check` to verify the local Codex path. The check uses temp repositories and an isolated Codex home.

Use `--dry-run` to preview the target path and final JSON without writing. If an existing `mcpServers.grape` entry differs, Grape requires `--force` before replacing only that entry. It preserves unrelated MCP servers.

This auto-install behavior is separate from the 1.0.0-beta.7 MCP stdio framing fix. Beta.7 made `grape mcp --stdio` connect correctly; it did not write client config files.

The default response mode is `agent_pack`. It is the normal mode for coding agents because it returns compact previews, diff state, restore IDs, invalidation IDs, artifact refs, warnings, and recovery guidance. Use `outputMode: "full"` only for inspection or compatibility.

In normal use, the agent should not ask you to paste a fresh repo summary every turn. It should call Grape, read the returned diff states, and keep going with the current task.

Minimum useful `grape_get_context` arguments:

```json
{
  "query": "Explain checkout discount behavior and related tests",
  "sessionId": "checkout-discount-review"
}
```

Better task-scoped call when the client or agent knows relevant files:

```json
{
  "query": "Explain checkout discount behavior and related tests",
  "sessionId": "checkout-discount-review",
  "files": ["src/checkout/discount.ts"],
  "tests": ["tests/checkout/discount.test.ts"]
}
```

Core agent rules:

- Read `NEW`, `CHANGED`, and `PINNED` context for the current turn.
- Treat `INVALIDATE_PREVIOUS` as stale context that must not be reused.
- Use `grape_get_omitted_item` only when a `RESTORE_AVAILABLE` body is needed.
- Keep the same `sessionId` and `query` for continued turns on the same task.
- Use `resetSession: true` only when the agent lost prior context for the same task.

The rest of this file is the detailed tool contract for implementers and reviewers.

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

The setup CLI now supports real client config installation for the two clients with safe paths in this slice:

- `grape mcp --install --client cursor` writes `.cursor/mcp.json` in the current repository.
- `grape mcp --install --client claude` writes Claude Desktop `claude_desktop_config.json` when the platform path can be resolved.
- `grape mcp --install --client codex` writes `.codex/config.toml` in the current repository.
- `grape mcp --print-agents-snippet` prints AGENTS.md setup guidance without writing files.
- `plugins/grape` provides a repo-local Codex plugin with Grape MCP config and a Grape skill.

Cursor and Claude merge `mcpServers.grape`. Codex merges `[mcp_servers.grape]`. The installers preserve unrelated entries, refuse invalid JSON or malformed Codex table headers, and require `--force` before replacing a conflicting existing Grape entry.

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

`grape mcp --stdio` implements MCP stdio JSON-RPC handling for `initialize`, `tools/list`, `tools/call`, and `ping`. Each input and output message is one UTF-8 JSON-RPC object on a single newline-delimited line. `Content-Length` header framing is rejected because MCP stdio clients send JSON lines. The `initialize` response includes MCP server instructions that tell Codex-style clients to call `grape_get_context`, keep stable session identity, invalidate stale context, and restore omitted context only when needed. The implemented Grape tools are:

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

`grape_get_context` calls the same local-project compile service used by `grape compile --task <text>`. It auto-bootstraps local `.grape/` state when needed, captures the current repo snapshot, persists source/index inputs, resolves task source hints from lexical task terms plus `files`, `symbols`, and `tests` seed refs, persists deterministic `symbol_outline` and `rule_digest` compression cache records before compilation, rebuilds and renders a deterministic prior-turn `context_pack_summary` only after filtering prior sent rows through current artifact staleness, compiles a repository-derived context artifact with pinned active project rules, non-proof compression orientation, and bounded exact-source evidence prioritized toward selected allowed sources. When retrieval selects source refs, exact-source proof rows and rendered current-valid claim sections stay scoped to those refs plus current project rules, covered symbol-declaration claims, and current-session observed-run results instead of filling the artifact with unrelated active claims from the same commit; if retrieval selects no refs, the compiler may fall back to bounded generic exact-source evidence. Path-like `tests` seed refs select matching allowed test source files and are shown as test seed refs in the task-retrieval section; non-path test names remain retrieval terms. When the AST relationship index records a test file importing or calling a selected source file, that test file is included as a related test ref. Exact-source proof windows prefer task-selected symbol anchors and can include up to two non-overlapping windows per selected source; query-term windows are used only when no symbol anchors exist for that source. The tool emits the public V1 `ContextArtifact` shape, persists section-scoped session diff rows, persists the next deterministic `context_pack_summary` from the current sent ledger, writes JSON/Markdown artifacts under `.grape/artifacts/`, and returns a compact agent-facing pack by default.

The public artifact includes `retrievalConfidence` when task retrieval runs. `safe` means current sources were selected from direct task evidence with no retrieval warnings. `partial` means selected context exists but evidence is weaker or warnings remain. `missing_likely_files` means missing seeds, no source matches, or caps suggest useful files were not included. MCP clients should treat that state as source-selection guidance, not proof of behavior, test coverage, root cause, or fix validity.

The default MCP `outputMode` is `agent_pack`. It returns compact preview `contextPackItems` and an `artifactRef` pointing at the stored full artifact. The default compact response omits inline `contextPackMarkdown` and experimental `agentGraph` data so agents do not pay for duplicated navigation or unproven graph structure by default.

To reduce duplicated agent-facing transport tokens, default `agent_pack` omits full item bodies from `contextPackItems` and returns `contentPreview`, `contentOmitted: true`, `contentHash`, and `tokenCount` instead. `contextPackItems[].inputRefs[].scope` is compacted to local routing keys such as branch, commit, worktree hash, dirty-worktree status, environment, package/service root, feature-flag count/hash, source scope, path, symbol, route, and test. It still omits repo, task, and session identifiers from compact refs. The full item bodies and full dependency scope remain in the stored public artifact JSON written under `artifactFiles.json`; callers can use `artifactRef.fullArtifactTool` (`grape_get_artifact` with `outputMode: "full"`) or request `grape_get_context` with `outputMode: "full"` when exact bodies are needed inline. Full artifact Markdown remains available at `artifactFiles.markdown`, and full inspection output may include inline `contextPackMarkdown` plus an `agentGraph` adjacency cut over the returned pack items. This graph cut is a transport aid: `contextPackItems` are nodes, `agentGraph.edges` express section/input/restore/invalidation relationships, and full dependency metadata stays in the stored artifact. It is not a new durable graph-memory product. `INVALIDATE_PREVIOUS` rows may be grouped in that Markdown summary, but every structured pack item still carries its own `invalidatesSentItemId`.

When `outputMode: "full"` is requested, MCP embeds the full `contextArtifact` object and full `ContextPackItem.content` payloads in the response. Use this for inspection or compatibility, not as the default agent transport path. MCP tool `content[0].text` is a short result summary; large structured payloads are not duplicated as pretty JSON text.

When the same MCP session identity is reused after a Git branch switch for the same task, the compile service updates the session's branch/head metadata under the session lock, records a `branch_changed` session invalidation event, and returns `INVALIDATE_PREVIOUS` items for stale branch-scoped context instead of `OMIT_UNCHANGED` items from the previous branch.

When `resetSession: true` is supplied for an existing MCP session, the compile service records a `session_reset` invalidation event, returns `INVALIDATE_PREVIOUS` items for active prior sent context, and forces full resend of current artifact sections instead of omitting unchanged sections.

Current limitation: the stored `contextArtifact`, optional full MCP `contextArtifact`, and public artifact JSON use the V1 `ContextArtifact` envelope, but durable current-valid rendering is intentionally limited to enabled narrow claim policies. The current implementation requires `sessionId` or `agentSessionId` so session-scoped diffing cannot collapse across independent agents. Prefer explicit `sessionId`; when it is omitted, Grape derives the session from `agentName`, `agentSessionId`, and the exact `query`, so query wording changes create a different derived session. Seed `files`, `symbols`, and `tests` participate in risk-overlay detection and source retrieval, but retrieval is still a conservative source-selection foundation over allowed snapshot records. TypeScript/JavaScript graph extraction is the strongest current language signal. Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, shell, JSON, YAML, TOML, and explicit Markdown paths rely on safe exact/path/lexical fallback unless a future provider proves stronger graph capabilities. Path-like test seeds and import-related test refs request exact test source context; they do not prove the tests passed or that behavior is correct. `symbol_outline`, `rule_digest`, and `context_pack_summary` compression are deterministic cache/orientation only; stale compression orientation can emit `INVALIDATE_PREVIOUS`, but compression still cannot prove claims or replace high-risk exact spans. `tokenBudget` prunes only optional non-safety context after required task summary, pinned, exact/safety-critical, omission/restore, and invalidation context fits; pruned bodies are removed from public `contextPackItems` and stored `contextArtifact.outputSections` and recorded in `contextArtifact.omittedDueToBudget` plus `budget.omittedDueToBudget`. If required context exceeds the budget, `compileMode` is `cannot_compile_safely`. `currentScope` reports the normalized compile scope used by CLI/MCP, compiler, retrieval, and claim filtering: branch, commit, worktree hash, dirty-worktree status, task/session IDs, environment label, package/service root when known, selected source refs, and explicit warnings. `environmentScope` is applied as a caller-supplied compile/current-valid scope label and artifact field; it does not prove runtime behavior in that environment, and `unknown` is not stamped onto durable claim scopes. `featureFlags` is accepted as a caller-supplied object of safe flag names to boolean/string values for current-valid filtering only; flag names must be allowlisted, and public MCP output returns only `featureFlagCount` plus `featureFlagScopeHash`, not flag labels or values. `agentName`, `agentSessionId`, and `resetSession` are accepted for contract compatibility. Detected risk overlays return `compileMode: "cannot_compile_safely"` with `risk_overlay_missing_exact_context` unless task retrieval or explicit seed refs select proof-backed exact source/config/rule evidence. Artifact file refs returned over MCP are repo-relative paths, not absolute local paths.

Unsafe or risky context outputs include `recoveryGuidance` so MCP consumers can decide whether to request narrower file/symbol/test seed refs for capped package or language groups, split seeded package or language work, increase a token budget, rerun after worktree cleanup, or inspect local state without guessing from internal errors.

`grape_get_artifact` returns stored artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public artifact file refs for one `artifactId`. Its default `outputMode` is `metadata`, which does not include context bodies. With `outputMode: "full"`, it also returns the stored public artifact JSON from `artifactFiles.json`, including full context-pack item bodies. It does not return internal repository backing files. MCP output omits absolute local root paths.

`grape_get_claims` returns current-valid durable claim metadata, defaulting to `activeOnly: true`. Current V1 implementation exposes narrow `repository_source_excerpt_exists` claims from validated exact-source proof rows, `repository_symbol_declaration_exists` claims from provider-backed AST declaration proofs, parsed `project_rule` claims from verified rule-file lines, and narrow `grape_observed_run_result` claims from trusted local Grape-observed command/test runs. It returns claim IDs, subjects, claim text, scope metadata, proof refs, source refs, and current-valid rejection counts. It does not return raw proof excerpts, source file bodies, raw command bodies, raw command output, or absolute local root paths.

`grape_get_proofs` returns persisted proof row metadata, optionally filtered by `proofId` or `sourceId`. It returns proof IDs, source IDs/refs, proof type, support status, source hashes, excerpt hashes, and optional claim IDs. It does not return raw proof excerpts or source file bodies. MCP output omits absolute local root paths.

`grape_get_rules` returns current Git-visible project rule excerpts after source-hash verification and the artifact secret scan. It uses the same rule-file classification as repository snapshots and removes `rootPath` from MCP output. Current V1 behavior returns hash-verified excerpts and deterministic proof IDs. Compile also promotes parsed `project_rule` claims from safe verified rule lines. Nested scope resolution and candidate/generated rule promotion remain pending.

`grape_get_omitted_item` restores one omitted context item by `sessionId` and `restoreToken`. It validates the token against the session, stored artifact metadata, stored dependency rows, artifact hash, section content hash, dependency manifest, redaction status, branch, head commit, worktree hash, source/config/lockfile/rule dependency hashes, and proof dependency rows/hashes before returning the omitted body. Stale restore attempts return `status: "stale"` with an error result rather than returning stale content. MCP output omits absolute local root paths.

`grape_get_stale_items` returns emitted stale-context invalidation metadata, optionally filtered by `sessionId`. It reuses the same local app service as `grape stale`, removes `rootPath` from MCP output, and does not return context bodies.

`grape_get_conflicts` returns open claim conflict edges from `claim_edges`, including `contradicts`, `needs_review`, `violates`, and `unknown_scope_overlap`. Conflict summaries include the public-safe edge authority category, bounded confidence, and short reason, but not raw proof/source bodies, prompts, command output, local paths, or private provenance details. Compile may create conservative `needs_review` edges for parsed project-rule claims when deterministic rule text signals opposing instructions over the same topic. MCP remains read-only for conflicts: manual resolution is a local CLI action and MCP write tools cannot resolve, merge, refute, promote claims, or mint blocking edge authority. The output removes `rootPath`.

`grape_get_status` returns the MCP-compatible form of `grape status --json` without CLI-only local path fields. It reports the observed local bootstrap state, database readiness, migration state, Git branch/head/worktree state, aggregate scan diagnostics, context freshness, session freshness, stale-context invalidation counts, `recoveryGuidance`, and `refreshRecommendations`. The freshness state is one of `fresh`, `stale`, `partial`, `unsafe`, or `unknown`; stale/unknown status is advisory and does not claim guaranteed background execution or guaranteed agent enforcement. Public MCP status output omits the internal config object, feature-flag allowlists, feature-flag values, file bodies, dirty diffs, remotes, and raw local absolute paths.

`grape_record_command_result` and `grape_record_test_result` persist agent-reported command/test observations as temporary `command_run` / `test_run` source evidence rows scoped to the current repo snapshot and an existing current context session. The adapter accepts the raw command only to verify `commandHash`; raw command, stdout, and stderr bodies are not persisted or returned. MCP callers cannot mint `observedRunId`, cannot self-declare `observedByGrape`, and cannot promote these rows to durable claims or proofs. The trusted observed-run path is the local CLI runner (`grape run` / `grape test`), which executes the command outside the MCP adapter, writes Grape-observed trusted source evidence, and may promote the narrow `grape_observed_run_result` proof/claim.

`grape_record_candidate` persists an agent-reported claim candidate as a non-durable `claim_candidates` row and links it to a temporary `assistant_response` source when the caller does not provide an existing current source. It returns candidate/source IDs only, not the raw claim text, and cannot promote the candidate to a durable claim.

`grape_record_user_decision` persists direct-confirmation metadata as a temporary redacted `user_message` source row. The adapter accepts raw prompt/response text only to verify `promptHash` and `responseHash`; raw prompt and response bodies are not persisted or returned.

`grape_request_user_confirmation` returns a deterministic non-durable confirmation request ID for a prompt hash and scope. It does not persist durable truth and tells the caller to collect direct user confirmation before calling `grape_record_user_decision`.

The V1 MCP surface is now implemented as a local-first foundation. Remaining work is hardening final durable current-valid retrieval and broader proof types without allowing MCP writes to promote truth directly.

V1 does not use restricted write tools as free-form artifact annotation channels. Agent-authored observations remain temporary evidence, candidates, hashes, or confirmation requests until a proof/scope flow validates them. Rendered artifact annotations are deferred by ADR-0008 so the Context Artifact remains a compiled, proof-backed output rather than an agent notebook.

## Read Tool Contract

```ts
interface GrapeGetContextInput {
  query: string;
  taskType?: Exclude<TaskType, "bootstrap">;
  files?: string[];
  symbols?: string[];
  tests?: string[];
  environmentScope?: "local" | "test" | "ci" | "staging" | "production" | "unknown";
  featureFlags?: Record<string, string | boolean>;
  tokenBudget?: number; // positive integer
  sessionId?: string;
  agentName?: string;
  agentSessionId?: string;
  resetSession?: boolean;
  outputMode?: "agent_pack" | "full";
}

interface GrapeGetContextOutput {
  artifactId: string;
  artifactHash: string;
  dependencyManifestHash: string;
  sessionId: string;
  branch: string;
  headCommit: string;
  dirtyWorktree: boolean;
  currentScope: ContextScope;
  taskType: TaskType;
  riskOverlays: RiskOverlay[];
  compileMode: CompileMode;
  retrievalConfidence?: {
    state: "safe" | "partial" | "missing_likely_files";
    reasons: string[];
  };
  outputMode: "agent_pack" | "full";
  artifactRef: {
    artifactId: string;
    artifactHash: string;
    dependencyManifestHash: string;
    artifactFiles: {
      json: string;
      markdown: string;
    };
    fullArtifactTool: {
      name: "grape_get_artifact";
      arguments: {
        artifactId: string;
        outputMode: "full";
      };
    };
  };
  agentGraph?: {
    graphFormat: "grape.agent-context-graph.v1";
    artifactId: string;
    artifactHash: string;
    dependencyManifestHash: string;
    nodeCounts: {
      packItems: number;
      sections: number;
      inputRefs: number;
      sentItems: number;
      restoreHandles: number;
    };
    nodes: Array<
      | { id: string; kind: "section"; sectionId: string }
      | { id: string; kind: "sent_item"; sentItemId: string }
      | { id: string; kind: "restore_handle"; restoreId: string }
    >;
    edges: Array<{
      from: string;
      to: string;
      kind: "renders_section" | "depends_on" | "invalidates" | "restores";
    }>;
  };
  contextArtifact?: ContextArtifact; // present only when outputMode === "full"
  contextPackItems: Array<AgentContextPackItem | ContextPackItem>;
  contextPackMarkdown?: string;
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
  recoveryGuidance?: string[];
  budget: {
    status: "not_requested" | "within_budget" | "over_budget" | "required_context_exceeds_budget";
    tokenBudget?: number;
    estimatedPackTokens: number;
    requiredContextTokens: number;
    omittedDueToBudget: Array<{
      id: string;
      itemKind: string;
      itemRef: string;
      itemHash: string;
      sectionId?: string;
      tokenCount: number;
      canRestore: boolean;
      restoreId?: string;
    }>;
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

interface AgentContextPackItem extends Omit<ContextPackItem, "content"> {
  contentPreview: string;
  contentOmitted: true;
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
  outputMode?: "metadata" | "full";
}

interface GrapeGetArtifactOutput {
  outputMode: "metadata" | "full";
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
  artifactBody?: {
    contextArtifact: ContextArtifact;
    contextPackItems: ContextPackItem[];
  };
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
- The current implementation returns V1-shaped `ContextPackItem[]` and a stored V1 `ContextArtifact`. MCP embeds that artifact only when `outputMode: "full"` is requested.

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
- Only a local Grape command runner may create Grape-observed command/test evidence with an observed run ID. The current runner commands are `grape run --session <id> -- <cmd...>` and `grape test --session <id> -- <cmd...>`.
- A Grape-observed run must include command hash, cwd, exit code, stdout/stderr hashes, and timestamps, and it must be created outside the MCP adapter. The local runner may promote only the narrow `grape_observed_run_result` proof/claim.
- User decisions require direct confirmation with prompt hash, response hash, timestamp, and confirmation channel.
- Write tools return evidence IDs or candidate IDs only. They do not return claim IDs for newly durable claims.
- Any broader promotion must replay Trust Kernel gates outside the MCP adapter.

## Contract Tests

- `mcp_get_context_returns_structured_items`
- `mcp_get_context_markdown_matches_items`
- `mcp_write_tool_cannot_promote_claim`
- `agent_reported_test_result_is_temporary`
- `grape_observed_run_requires_command_and_output_hashes`
- `user_decision_requires_direct_confirmation_hashes`
- `ignored_file_read_requires_approval`
- `unsafe_compile_does_not_return_safe_status`

## Beta Verification

Local release sign-off should run:

```bash
npm run beta:check
```

`npm run beta:client-trial` is the packaged-install MCP trial inside that gate. It proves:

- packed tarball install in a clean consumer git repo
- `grape help` and `grape init --connect`
- MCP `initialize` and `tools/list`
- `grape_get_status` without absolute repo path leaks
- first `grape_get_context` turn with `NEW` context
- second same-session turn with `OMIT_UNCHANGED` and `RESTORE_AVAILABLE`
- `grape_get_omitted_item` restore
- source edit invalidation with `INVALIDATE_PREVIOUS`
- stale restore rejection after the source edit
- task/session mismatch error with `recoveryGuidance`
- `resetSession: true` invalidation and current resend
- branch switch invalidation
- rejection of ignored `.env`, private, and ignore-listed secret-looking files in output

This trial exercises Cursor and Claude Desktop install dry-runs plus MCP over stdio from an installed package. A literal Cursor, Claude Desktop, or Claude Code UI configuration trial is still a separate human step when release policy requires it. See [`beta-trial-checklist.md`](../planning/beta-trial-checklist.md).
