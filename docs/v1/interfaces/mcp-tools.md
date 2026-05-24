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

## Read Tool Contract

```ts
interface GrapeGetContextInput {
  query: string;
  taskType?: Exclude<TaskType, "bootstrap">;
  files?: string[];
  symbols?: string[];
  tests?: string[];
  environmentScope?: "local" | "test" | "ci" | "staging" | "production" | "unknown";
  tokenBudget?: number;
  sessionId?: string;
  agentName?: string;
  agentSessionId?: string;
}

interface GrapeGetContextOutput {
  artifactId: string;
  sessionId: string;
  branch: string;
  headCommit: string;
  dirtyWorktree: boolean;
  taskType: TaskType;
  riskOverlays: RiskOverlay[];
  compileMode: CompileMode;
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
  restoreAvailable: boolean;
}
```

Rules:

- `contextPackItems` is canonical. Markdown is only a rendering.
- `compileMode` carries `safe`, `partial_with_risk`, or `unsafe_compile` semantics from the compiler.
- `unsafe_compile` must not return unsafe context as if it were safe.
- `partial_with_risk` must include explicit warnings and missing-context reasons.
- Read tools must never silently read ignored/private files.
- This is the final V1 MCP contract, not part of the current In-Memory Context Loop implementation goal.

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
