# V1 CLI

## Purpose

Define CLI command contracts for setup, inspection, debugging, and fallback workflows.

## Required Contents

- command list
- output format expectations
- exit code rules
- privacy/debug commands
- snapshot test requirements

## Readers

CLI implementers, users, and AI agents debugging local state.

## Update Triggers

- CLI command changes
- output shape changes
- setup flow changes
- diagnostic behavior changes

## Agent Checks

Before editing CLI behavior, agents must verify:

- CLI does not own business logic
- CLI calls app services
- new commands have docs and snapshot tests
- privacy-sensitive output is redacted

## Required Command Groups

- everyday: `grape help`, `grape status`, `grape doctor`
- setup/MCP: `grape init --connect`, `grape mcp`, `grape mcp --print-config`, `grape mcp --stdio`
- fallback: `grape sync`, `grape compile`, `grape diff-context`
- inspection: `grape sessions`, `grape artifacts`, `grape claims --active`, `grape proofs`, `grape proofs <claim_id>`, `grape stale`, `grape conflicts`, `grape omitted`
- decisions: `grape add-decision`, `grape decisions review`
- benchmarks: `grape bench`, `grape bench --fixture <name>`
- privacy: `grape doctor --privacy`, `grape export`, `grape purge`

## Implemented Setup Slice

The current implementation includes the first CLI setup/debugging slice:

- `grape help`
- `grape init --connect`
- `grape compile --task <text>`
- `grape compile --task <text> --reset-session`
- `grape sessions`
- `grape stale`
- `grape artifacts`
- `grape artifacts --artifact <id>`
- `grape bench --fixture <name>`
- `grape proofs`
- `grape proofs --proof <id>`
- `grape proofs --source <sourceId>`
- `grape conflicts`
- `grape omitted --session <id>`
- `grape omitted --session <id> --token <restoreToken>`
- `grape status`
- `grape doctor`
- `grape mcp --print-config`
- `grape mcp --stdio`

`grape init --connect` creates the local `.grape/` layout, writes `.grape/config.json`, applies SQLite migrations to `.grape/grape.db`, captures and persists the first Git repo snapshot, persists allowed source records plus privacy-safe source rejections, persists lightweight file/symbol relationship index rows, and adds `.grape/` to `.git/info/exclude` so local Grape state is not committed. It also reports bootstrap detection for common root manifests/config files: languages, frameworks, package manager, script names, derived commands, test command, entry points, config files, candidate rules, confidence levels, and warnings. Candidate rules are setup hints only and are not durable project rules or confirmed decisions. If local config is malformed or missing its schema/project identity fields, init treats it as repairable partial bootstrap state: it copies the old file to `.grape/config.invalid.<timestamp>.json` before writing a fresh local config. Unsupported future config schema versions still fail closed instead of being overwritten.

`grape compile --task <text>` auto-bootstraps local `.grape/` state if needed, including repairable malformed local config backup/rewrite, captures the current Git snapshot, persists source evidence and the lightweight file/FTS index, resolves task source hints from lexical terms plus symbol/path matches, validates and persists accepted exact source proof rows, persists deterministic `symbol_outline` and `rule_digest` compression cache records before compilation, compiles a repository-derived context artifact with pinned active project rules, non-proof compression orientation, and bounded exact-source evidence prioritized toward selected allowed sources, projects it to the public V1 `ContextArtifact` JSON shape, runs session diffing, persists the durable context build, then persists a deterministic `context_pack_summary` from the current sent ledger. It evaluates any requested token budget without pruning required context and writes inspectable JSON and Markdown under `.grape/artifacts/`. The public JSON contains `contextArtifact` plus `contextPackItems`; Markdown renders artifact summary, diff counts, item input refs, omitted/restore metadata, output sections, dependency manifest details, token/budget status, and warnings/safety fields for human and agent inspection. The internal `.scaffold.json` sidecar is used only for omitted-item restore verification. Supported options are `--task-type <type>`, `--risk <overlay,overlay>`, `--session <id>`, `--reset-session`, `--token-budget <tokens>`, `--repo <path>`, and `--json`. Risk overlays can be detected from the task text or supplied explicitly through `--risk`; they return exit code `2` with `risk_overlay_missing_exact_context` unless task retrieval or explicit seed refs select proof-backed exact source/config/rule evidence. If a token budget cannot fit pinned/exact/invalidation context, compile also returns exit code `2` with `token_budget_below_required_context`.

Unsafe compile results include `recoveryGuidance` in JSON and human output. Current guidance covers missing exact context for risk overlays, token budgets below required context, dirty worktree scope, and over-budget packs. Lock, stale, privacy/redaction, missing config, root mismatch, and missing Git metadata errors render recovery guidance on stderr where applicable.

When an explicit `--session` is reused after switching Git branches for the same task, `grape compile` keeps the session but treats the branch change as a session invalidation event. It updates the session's current branch/head metadata under the durable build lock, emits `INVALIDATE_PREVIOUS` rows for stale branch-scoped context, and does not emit `OMIT_UNCHANGED` for the previous branch's context.

When `--reset-session` is supplied for an existing compile session, `grape compile` records a session reset event, emits `INVALIDATE_PREVIOUS` rows for active prior sent items, and forces the current scaffold artifact sections to be resent instead of using `OMIT_UNCHANGED`. This is the recovery path for agents that lost prior context.

`grape artifacts` lists stored context artifacts from local SQLite metadata. `grape artifacts --session <id>` filters that list to one context session. `grape artifacts --artifact <id>` returns artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public `.grape/artifacts/` file refs. It is an inspection command and does not return internal scaffold sidecar bodies.

`grape bench --fixture <name>` runs the first scripted V1 token-reduction benchmark. The command copies the named fixture into a temporary Git repository, runs the real local compile/diff path twice with the same session, and reports first-turn cost, second-turn cost, omitted unchanged tokens, restore hints, invalidation counts, wall-clock timings, unsafe omissions, stale sends, and threshold failures. The default fixture lookup is `<repo>/tests/fixtures/<name>` where `<repo>` comes from `--repo <path>` or the current working directory. `--fixture-path <path>` can point at an explicit fixture directory. `--keep-workspace` preserves the copied temporary workspace for debugging. The benchmark fails closed when second-turn reduction is below the current alpha threshold, unsafe omissions are present, stale items are sent, no unchanged items are omitted, or no restore hint is emitted.

`grape sessions` lists context sessions, branch/head state, task metadata, lock status, artifact/sent/omitted/pack counts, event counts, and the last event reason. It is a debug command for session-scoped diff behavior and does not return context bodies.

`grape stale` lists context pack invalidation rows that mark previously sent context as stale. `grape stale --session <id>` filters to one context session. Current V1 behavior is an invalidation-ledger inspector, not a predictive stale analyzer: it reports dependency-manifest, branch-switch, and session-reset invalidations already emitted by the diff engine, along with prior sent item IDs and previous branch/head metadata. It does not return context bodies.

`grape conflicts` lists recorded claim conflict edges from `claim_edges`, including `contradicts`, `needs_review`, `violates`, and `unknown_scope_overlap`. Current V1 behavior is an inspector only: it does not detect new contradictions, resolve conflicts, or promote/refute claims.

`grape claims --active` lists current-valid durable claims from local SQLite metadata. Current V1 implementation exposes only the narrow `repository_source_excerpt_exists` claim type created from validated exact-source proof rows. It returns claim IDs, subjects, claim text, scope metadata, proof refs, source refs, and current-valid rejection counts. It does not return raw proof excerpts or source file bodies.

`grape proofs` lists persisted proof rows from local SQLite metadata. `grape proofs --proof <id>` inspects one proof row, and `grape proofs --source <sourceId>` filters proof rows by source. It returns proof IDs, source IDs/refs, proof type, support status, source hashes, excerpt hashes, and optional claim IDs. It does not return raw proof excerpts or source file bodies. The future `grape proofs <claim_id>` claim-linked form remains deferred until durable claims exist.

`grape omitted --session <id>` lists omitted context rows for a session. `grape omitted --session <id> --token <restoreToken>` validates the token against the session, stored artifact metadata, stored dependency rows, artifact hash, section content hash, dependency manifest, redaction status, current branch, head commit, worktree hash, source/config/lockfile/rule dependency hashes, and proof dependency rows/hashes before returning the omitted body. If any dependency is stale, the command exits `3` and returns stale metadata instead of sending old context, with recovery guidance in human output.

`grape status` reports initialization, config, database, migration, branch, head commit, worktree state, and setup recovery guidance. Repairable malformed config and unsupported future config schema versions are reported distinctly so agents know whether `grape init --connect` can safely repair the state. `grape doctor` reports setup diagnostics, Node runtime compatibility, migration state, dirty worktree state, whether `.grape/` is locally excluded from Git, and recovery guidance for failed or warning checks.

`grape mcp --print-config` prints the V1 MCP connection shape for stdio clients, including `--repo <root>` and `cwd` guidance so MCP clients do not accidentally launch Grape against their own working directory. `grape mcp --stdio` serves the first MCP adapter with `grape_get_context`, `grape_get_artifact`, `grape_get_claims`, `grape_get_proofs`, `grape_get_rules`, `grape_get_omitted_item`, `grape_get_stale_items`, `grape_get_conflicts`, `grape_get_status`, `grape_record_candidate`, `grape_record_command_result`, `grape_record_test_result`, `grape_record_user_decision`, and `grape_request_user_confirmation`; the context tool reuses the local compile service and returns V1-shaped context-pack items while the stored artifact body remains the documented scaffold artifact shape. The write tools record temporary agent-reported evidence or confirmation requests only and do not promote durable claims.

All implemented commands support `--repo <path>` where relevant and `--json` for machine-readable output. Unsupported options fail with a usage error instead of being silently ignored; for example, `grape doctor --privacy` is documented V1 scope but is not accepted until the privacy-specific doctor workflow exists.

## Adapter Rule

The CLI must call application services. It must not:

- execute raw SQL,
- promote claims,
- bypass current-valid retrieval,
- read ignored/private files without approval,
- make compression authoritative,
- own compiler policy.

## Output Rules

- Human output is Markdown or plain tables.
- Machine output uses `--json` and must match documented schemas.
- Snapshot tests cover human output.
- Contract tests cover JSON output.
- Privacy-sensitive output is redacted by default.

## Exit Codes

| Code | Meaning |
|---:|---|
| 0 | command succeeded |
| 1 | validation or usage error |
| 2 | unsafe compile or blocked privacy/security action |
| 3 | stale local state requires sync/retry |
| 4 | storage/schema failure |
| 5 | lock conflict |

## Command Notes

- `grape claims --active` shows current-valid durable claims and proof refs without source bodies.
- `grape sessions` shows session and ledger counts without context bodies.
- `grape stale` shows invalidated prior sent item refs without context bodies.
- `grape proofs --proof <id>` shows proof refs, source refs, support status, and hashes. It must not show raw secrets. Claim-linked `grape proofs <claim_id>` remains pending until broader claim-linked proof inspection exists.
- `grape bench` runs scripted benchmarks only. It must not use ad hoc baselines.
- `grape add-decision` records a user decision candidate and requires direct confirmation before it can become durable evidence.
- `grape decisions review` lists decisions, scope, prompt hashes, response hashes, and stale status.

## Required Tests

- `cli_status_snapshot`
- `cli_doctor_privacy_redacts_secrets`
- `cli_json_matches_schema`
- `cli_proofs_does_not_show_raw_secret`
- `cli_add_decision_requires_confirmation`
- `cli_bench_requires_named_fixture`
