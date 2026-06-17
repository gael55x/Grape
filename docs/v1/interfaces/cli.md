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

## Reviewer Note: Artifact Vs Durable Truth

Public CLI JSON uses the V1 `ContextArtifact` envelope and compiles repository-derived sections from proof-backed excerpts, current-valid narrow claims, dependency refs, and orientation-only index data. Treat artifacts as inspectable, dependency-tracked context, not as proof of runtime behavior or complete durable memory. See `docs/v1/contracts/context-artifact.md`.

For continued-turn behavior, task/session identity, mismatch recovery, and published-package install troubleshooting, see [`agent-sessions.md`](agent-sessions.md).

## Command Status

### Implemented

| Group | Commands |
|---|---|
| Everyday | `grape help`, `grape --version`, `grape version`, `grape status`, `grape doctor`, `grape doctor --privacy` |
| Setup / MCP | `grape init --connect`, `grape sync`, `grape mcp --install --client cursor`, `grape mcp --install --client claude`, `grape mcp --print-config`, `grape mcp --stdio` |
| Fallback compile | `grape compile`, `grape diff-context` |
| Observed runs | `grape run --session <id> -- <cmd...>`, `grape test --session <id> -- <cmd...>` |
| Inspection | `grape sessions`, `grape artifacts`, `grape claims --active`, `grape proofs`, `grape proofs --proof <id>`, `grape proofs --source <sourceId>`, `grape stale`, `grape conflicts`, `grape omitted` |
| Benchmarks | `grape bench --fixture <name>` |

### Still Specified For V1.0 / Deferred From Current Beta Slice

These commands are not removed from V1.0. They remain planned command surfaces, but they need their proof, privacy, or durable-data contracts before they can be implemented safely.

| Command | Status |
|---|---|
| `grape add-decision` | Specified; not implemented. Would record user decision candidates and require direct confirmation before durable evidence. |
| `grape decisions review` | Specified; not implemented. |
| `grape export` | Specified; deferred until export data contract exists. |
| `grape purge` | Specified; deferred until purge data contract exists. |
| `grape proofs <claim_id>` | Specified claim-linked form; deferred. Use `grape proofs --proof <id>` today. |

## Command Groups

Implemented command groups:

- everyday: `grape help`, `grape --version`, `grape version`, `grape status`, `grape doctor`, `grape doctor --privacy`
- setup/MCP: `grape init --connect`, `grape sync`, `grape mcp`, `grape mcp --install --client cursor`, `grape mcp --install --client claude`, `grape mcp --print-config`, `grape mcp --stdio`
- fallback compile: `grape compile --task <text>`, `grape diff-context --task <text>`
- observed runs: `grape run --session <id> -- <cmd...>`, `grape test --session <id> -- <cmd...>`
- inspection: `grape sessions`, `grape artifacts`, `grape claims --active`, `grape proofs`, `grape proofs --proof <id>`, `grape proofs --source <sourceId>`, `grape stale`, `grape conflicts`, `grape omitted`
- benchmarks: `grape bench --fixture <name>`

Still part of V1.0, but deferred from the current beta transport slice:

- decisions: `grape add-decision`, `grape decisions review`
- claim-linked proof inspection: `grape proofs <claim_id>`
- privacy/data export: `grape export`, `grape purge`

## Implemented Setup Slice

The current implementation includes the first CLI setup/debugging slice:

- `grape help`
- `grape --version`
- `grape version`
- `grape init --connect`
- `grape sync`
- `grape compile --task <text>`
- `grape compile --task <text> --reset-session`
- `grape diff-context --task <text>`
- `grape diff-context --task <text> --explain`
- `grape run --session <id> -- <cmd...>`
- `grape test --session <id> -- <cmd...>`
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
- `grape doctor --privacy`
- `grape mcp --install --client cursor`
- `grape mcp --install --client claude`
- `grape mcp --print-config`
- `grape mcp --stdio`

`grape init --connect` creates the local `.grape/` layout, writes `.grape/config.json`, applies SQLite migrations to `.grape/grape.db`, captures and persists the first Git repo snapshot, persists allowed source records plus privacy-safe source rejections, persists lightweight file/symbol relationship index rows, and adds `.grape/` to `.git/info/exclude` so local Grape state is not committed. It also reports bootstrap detection for common root manifests/config files: languages, frameworks, package manager, script names, derived commands, test command, entry points, config files, candidate rules, confidence levels, and warnings. Init output includes scan diagnostics with visible-file and rejected-file counts plus rejection reason totals for ignored, private, unreadable, oversized, and binary files. Candidate rules are setup hints only and are not durable project rules or confirmed decisions. If local config is malformed or missing its schema/project identity fields, init treats it as repairable partial bootstrap state: it copies the old file to `.grape/config.invalid.<timestamp>.json` before writing a fresh local config. If the local SQLite database is unusable because it is corrupt or is non-empty without trusted migration metadata, init moves it to `.grape/grape.db.invalid.<timestamp>` before creating fresh local database state. Unsupported future config schema versions still fail closed instead of being overwritten.

`grape sync` is the manual fallback for refreshing local Grape inputs without generating a context pack. It reuses the same local bootstrap/snapshot/evidence/index path as init, so it can create or repair local `.grape/` state, back up unusable local databases before recreating them, apply migrations, persist the current Git snapshot, persist allowed source/rejection evidence, persist lightweight file/lexical index rows, and report scan diagnostics. It does not return context bodies, create context artifacts, update session sent ledgers, or promote durable claims.

`grape compile --task <text>` auto-bootstraps local `.grape/` state if needed, including repairable malformed local config backup/rewrite and unusable local database backup/recreation, captures the current Git snapshot, persists source evidence and the provider-backed AST/lexical index, resolves task source hints from lexical terms plus symbol/path matches, validates and persists accepted exact source proof rows, persists deterministic `symbol_outline` and `rule_digest` compression cache records before compilation, rebuilds and renders a deterministic prior-turn `context_pack_summary` only after filtering prior sent rows through current artifact staleness, compiles a repository-derived context artifact with pinned active project rules, non-proof compression orientation, and bounded exact-source evidence prioritized toward selected allowed sources. TypeScript/JavaScript graph extraction is the strongest current language signal. Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, shell, JSON, YAML, TOML, and explicit Markdown paths rely on safe exact/path/lexical fallback unless a future provider proves stronger graph capabilities. Compile also promotes parsed `project_rule` claims from safe verified rule-file lines and provider-backed `repository_symbol_declaration_exists` claims for high-confidence TypeScript/JavaScript AST declarations covered by accepted exact source windows. When task retrieval selects source refs, exact-source proof rows and rendered current-valid claim sections stay scoped to those refs plus current project rules, covered symbol-declaration claims, and observed test-run results that explicitly name a selected test file, instead of filling the artifact with unrelated active claims from the same commit; if retrieval selects no refs, compile may fall back to bounded generic exact-source evidence. Exact-source proof windows prefer task-selected symbol anchors and can include up to two non-overlapping windows per selected source; query-term windows are used only when no symbol anchors exist for that source. If selected implementation sources have no related test refs, task retrieval emits `task_retrieval_no_related_tests_found` so agent output does not imply test coverage was proven. The compiler emits the public V1 `ContextArtifact` JSON shape, runs section-scoped session diffing, persists the durable context build, then persists the next deterministic `context_pack_summary` from the current sent ledger. It applies any requested token budget before context-pack rows are persisted: task summary, pinned, exact/safety-critical, omission/restore, and invalidation context is never pruned; optional non-safety context may be pruned and recorded in `contextArtifact.omittedDueToBudget` plus `budget.omittedDueToBudget`. It writes inspectable JSON and Markdown under `.grape/artifacts/`. The public JSON contains `contextArtifact` plus `contextPackItems`; public path fields are sanitized by default, using `<repo-root>` for paths under the active repository and repo-relative `.grape/artifacts/` refs for artifact inspection where practical. Human output includes pack item, sent item, omitted unchanged, restore available, and invalidated previous counts. Markdown renders artifact summary, diff counts, item input refs, omitted/restore metadata, output sections, dependency manifest details, token/budget status, and warnings/safety fields for human and agent inspection. Source and rule excerpt bodies are rendered as fenced untrusted repository evidence. The internal `.repository.json` backing file is used only for omitted-item restore verification. Supported options are `--task-type <type>`, `--environment-scope <local|test|ci|staging|production|unknown>`, `--feature-flags <name[,name=value...]>`, `--risk <overlay,overlay>`, `--session <id>`, `--reset-session`, `--token-budget <tokens>`, `--repo <path>`, and `--json`. Compile returns a `currentScope` object that carries branch, commit, worktree hash, dirty-worktree status, task/session IDs, environment label, package/service root when determinable, selected source refs, and unsupported or partial-analysis warnings. Environment scope is a caller-supplied current-scope label and artifact field, not proof of runtime behavior in that environment; `unknown` is not stamped onto durable claim scopes. Feature flags are caller-supplied current-valid filters only; accepted flag names must be present in the local scope allowlist, and public output exposes only `featureFlagCount` plus `featureFlagScopeHash`, not flag labels or values. Risk overlays can be detected from the task text or supplied explicitly through `--risk`; they return exit code `2` with `risk_overlay_missing_exact_context` unless task retrieval or explicit seed refs select proof-backed exact source/config/rule evidence relevant to the detected overlay. If a token budget cannot fit pinned/exact/invalidation context, compile also returns exit code `2` with `token_budget_below_required_context`.

`grape diff-context --task <text>` is an explicit manual fallback for the compile-plus-session-diff path. It accepts the same task/session/risk/budget flags as `grape compile`, returns the same JSON shape, writes the same artifact files, and labels human output as a context diff. It exists so scripts and agents can request the V1 diff operation by name without knowing that `compile` already performs diffing.

`grape diff-context --task <text> --explain` adds a human-readable per-item diff reason list for the current pack. It does not change JSON output fields or transport contracts.

`grape run --session <id> -- <cmd...>` and `grape test --session <id> -- <cmd...>` execute local commands from the repository root and persist Grape-observed `command_run` / `test_run` source evidence rows against the existing current context session. These commands are the trusted local runner path: they reject secret-looking command text before execution, create an `observedRunId`, mark the source row `trust_class = "trusted"`, set `observedBy = "grape"` / `observedByGrape = true`, and store command/stdout/stderr hashes, exit code, cwd, timestamps, branch, commit, worktree hash, and session scope. Raw command, stdout, and stderr bodies are not persisted or emitted in JSON. `grape test` sets `passed` from the command exit code, accepts `--test-framework <name>` as a label, and records explicit safe repo-relative test file arguments as `testFiles` metadata when present. The runner now promotes the narrow durable `grape_observed_run_result` proof/claim in the same transaction as the source row. That claim proves only that Grape observed the run result, not that product behavior is correct, that the named test covers a selected source, or that a root cause was fixed.

Unsafe compile results include `recoveryGuidance` in JSON and human output. Current guidance covers missing exact context for risk overlays, token budgets below required context, capped package or language source groups, capped seeded package or language groups, dirty worktree scope, and over-budget packs. Lock, stale, privacy/redaction, missing config, root mismatch, and missing Git metadata errors render recovery guidance on stderr where applicable.

When an explicit `--session` is reused after switching Git branches for the same task, `grape compile` keeps the session but treats the branch change as a session invalidation event. It updates the session's current branch/head metadata under the durable build lock, emits `INVALIDATE_PREVIOUS` rows for stale branch-scoped context, and does not emit `OMIT_UNCHANGED` for the previous branch's context.

When `--reset-session` is supplied for an existing compile session, `grape compile` records a session reset event, emits `INVALIDATE_PREVIOUS` rows for active prior sent items, and forces the current artifact sections to be resent instead of using `OMIT_UNCHANGED`. This is the recovery path for agents that lost prior context.

`grape artifacts` lists stored context artifacts from local SQLite metadata. `grape artifacts --session <id>` filters that list to one context session. `grape artifacts --artifact <id>` returns artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative public `.grape/artifacts/` file refs. It is an inspection command and does not return internal repository backing files.

`grape bench --fixture <name>` runs the scripted token-reduction benchmark. The command copies the named fixture into a temporary Git repository, runs the real local compile/diff path twice with the same session, and reports first-turn cost, second-turn cost, omitted unchanged tokens, restore hints, invalidation counts, wall-clock timings, unsafe omissions, stale sends, and threshold failures. The default fixture lookup is `<repo>/tests/fixtures/<name>` where `<repo>` comes from `--repo <path>` or the current working directory. `--fixture-path <path>` can point at an explicit fixture directory. When `--task <text>` is omitted, Grape reads the default task from that fixture's `grape-fixture.json` `benchmarkTask` field. `--keep-workspace` preserves the copied temporary workspace for debugging, but public benchmark output is still sanitized by default and must not include raw local absolute paths, usernames, API keys, tokens, or secret-looking values. The benchmark fails closed when second-turn reduction is below the current benchmark threshold, unsafe omissions are present, stale items are sent, no unchanged items are omitted, or no restore hint is emitted.

`grape sessions` lists context sessions, branch/head state, task metadata, lock status, artifact/sent/omitted/pack counts, event counts, and the last event reason. It is a debug command for session-scoped diff behavior and does not return context bodies.

`grape stale` lists context pack invalidation rows that mark previously sent context as stale. `grape stale --session <id>` filters to one context session. Current V1 behavior is an invalidation-ledger inspector, not a predictive stale analyzer: it reports dependency-manifest, branch-switch, and session-reset invalidations already emitted by the diff engine, along with prior sent item IDs and previous branch/head metadata. It does not return context bodies.

`grape conflicts` lists open claim conflict edges from `claim_edges`, including `contradicts`, `needs_review`, `violates`, and `unknown_scope_overlap`. Conflict output includes the public-safe authority category, bounded confidence, and short reason. It must not include raw proof/source bodies, prompts, command output, local paths, or private provenance details. Compile creates conservative `needs_review` edges for parsed project-rule claims when deterministic rule text signals opposing instructions over the same topic. `grape conflicts --resolve <edgeId> --as coexists_with` or `--as variant_of` records a manual `user_confirmation` resolution edge so the conflict no longer appears as open. The resolution command does not refute, rewrite, or promote claims; it records only the developer's local conflict-resolution decision.

`grape claims --active` lists current-valid durable claims from local SQLite metadata. Current V1 implementation exposes narrow `repository_source_excerpt_exists` claims from validated exact-source proof rows, `repository_symbol_declaration_exists` claims from provider-backed AST declaration proofs, parsed `project_rule` claims from verified rule-file lines, and narrow `grape_observed_run_result` claims from trusted local Grape-observed command/test runs. It returns claim IDs, subjects, claim text, scope metadata, proof refs, source refs, and current-valid rejection counts. Human output labels `verificationStatus = verified` as `proof_policy_accepted (verified)` to avoid correctness overclaim. Generated claim text uses conservative disclaimers and must not imply root cause, fix validity, semantic authority, or benchmark savings. It does not return raw proof excerpts, source file bodies, raw command bodies, or raw command output.

`grape proofs` lists persisted proof rows from local SQLite metadata. `grape proofs --proof <id>` inspects one proof row, and `grape proofs --source <sourceId>` filters proof rows by source. It returns proof IDs, source IDs/refs, proof type, support status, source hashes, excerpt hashes, and optional claim IDs. It does not return raw proof excerpts or source file bodies. The future `grape proofs <claim_id>` claim-linked form remains deferred until durable claims exist.

`grape omitted --session <id>` lists omitted context rows for a session. `grape omitted --session <id> --token <restoreToken>` validates the token against the session, stored artifact metadata, stored dependency rows, artifact hash, section content hash, dependency manifest, redaction status, current branch, head commit, worktree hash, source/config/lockfile/rule dependency hashes, and proof dependency rows/hashes before returning the omitted body. If any dependency is stale, the command exits `3` and returns stale metadata instead of sending old context, with recovery guidance in human output.

`grape status` reports initialization, config presence, database readiness, migration state, branch, head commit, worktree state, current scan diagnostics, context freshness, session freshness, stale-context invalidation counts, and refresh recommendations. Human output qualifies `fresh` as advisory and not guaranteed agent enforcement. Machine output from `grape status --json` exposes `status` and `freshness.status` as one of `fresh`, `stale`, `partial`, `unsafe`, or `unknown`. Ordinary stale, partial, unsafe, and unknown diagnostic states are successful status results; `grape status --json` exits non-zero only when the command itself cannot run. Repairable malformed config, unusable local databases, unsafe symlinked local state, and unsupported future config schema versions are reported distinctly so agents know whether `grape init --connect` can safely repair the state. Public status JSON does not include the internal config object, feature-flag allowlists, feature-flag values, file bodies, dirty diffs, remotes, or raw local absolute paths. `grape doctor` remains the stricter setup health gate: it reports setup diagnostics, Node runtime compatibility, migration state, dirty worktree state, whether `.grape/` is locally excluded from Git, and recovery guidance for failed or warning checks. A present but unreadable local database fails the database and migration checks instead of being treated as a healthy bootstrap.

`grape doctor --privacy` narrows doctor output to privacy and local-first diagnostics. It reports local-first defaults, `.grape/` Git exclusion, aggregate scanner rejection counts, ignored/private input handling, and artifact secret-scan coverage without returning file bodies, secret values, or raw rejected-file contents. It does not approve ignored/private reads, export data, purge data, or change scanner policy.

`grape mcp --install --client cursor` writes or merges project-local `.cursor/mcp.json`. `grape mcp --install --client claude` writes or merges Claude Desktop `claude_desktop_config.json` when Grape can resolve the platform path safely. Both commands add or update only `mcpServers.grape`, preserve unrelated MCP servers and top-level config, fail safely on invalid JSON, treat identical existing Grape entries as already configured, and require `--force` before replacing a conflicting existing Grape entry. `--dry-run` prints the target path and final JSON without writing. Auto-install is currently supported for Cursor and Claude Desktop only; other clients use `grape mcp --print-config` for manual setup.

`grape mcp --print-config` prints the V1 MCP connection shape for stdio clients, including `--repo <root>` and `cwd` guidance so MCP clients do not accidentally launch Grape against their own working directory. The auto-install commands use the same Grape server config as this manual path. `grape mcp --stdio` serves the first MCP adapter with `grape_get_context`, `grape_get_artifact`, `grape_get_claims`, `grape_get_proofs`, `grape_get_rules`, `grape_get_omitted_item`, `grape_get_stale_items`, `grape_get_conflicts`, `grape_get_status`, `grape_record_candidate`, `grape_record_command_result`, `grape_record_test_result`, `grape_record_user_decision`, and `grape_request_user_confirmation`; the context tool reuses the local compile service and returns compact `agent_pack` transport by default: preview context-pack items with full hashes and artifact refs. Full context-pack item bodies and embedded artifacts require `outputMode: "full"` or `grape_get_artifact`; inline inspection Markdown and the experimental adjacency graph require `outputMode: "full"`. The write tools record temporary agent-reported evidence or confirmation requests only and do not promote durable claims. Use the local CLI runner commands, not MCP writes, when command/test evidence must be Grape-observed.

All implemented commands support command-specific `--help`. Storage-backed commands support `--repo <path>` where relevant and `--json` for machine-readable output. Public stdout/stderr and JSON output are sanitized by default: absolute local paths, private workspace names, usernames embedded in local paths, API keys, tokens, private-key-looking values, and sensitive object-field values are redacted or replaced with placeholders. Unsupported options fail with a usage error instead of being silently ignored; privacy export and purge workflows remain deferred until their data contracts exist.

Runtime compatibility is checked before storage-backed commands import SQLite-backed application services. `grape help`, `grape init --help`, top-level `-h`/`--help`, `grape mcp`, `grape mcp --print-config`, and `grape mcp --install` remain available on older Node runtimes so setup guidance and client config writing can still render. Commands that need local storage, including `init`, `sync`, `status`, `doctor`, `compile`, `diff-context`, inspection commands, benchmarks, and `mcp --stdio`, require Node.js 22.13 or newer in the published package. If the runtime is too old, the CLI fails before bootstrap with recovery guidance. `grape doctor --json` can still return a minimal machine-readable `node_runtime` failure without importing storage modules.

Package builds must include the compiled `dist/cli/index.js` binary target and copied SQL migrations under `dist/core/storage/migrations/` so globally installed storage-backed commands can bootstrap without access to TypeScript source files.

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
| 3 | stale local state or unsupported local runtime requires setup/sync/retry |
| 4 | storage/schema failure |
| 5 | lock conflict |
| 6 | explicit context session reused with a different task or task type |

## Command Notes

- `grape claims --active` shows current-valid durable claims and proof refs without source bodies.
- `grape sessions` shows session and ledger counts without context bodies.
- `grape stale` shows invalidated prior sent item refs without context bodies.
- `grape proofs --proof <id>` shows proof refs, source refs, support status, and hashes. It must not show raw secrets. Claim-linked `grape proofs <claim_id>` remains pending until broader claim-linked proof inspection exists.
- `grape bench` runs scripted benchmarks only. It must not use ad hoc baselines.
- `grape run` and `grape test` create trusted Grape-observed source evidence rows only after executing the command locally. They may promote only the narrow `grape_observed_run_result` proof/claim and must not persist raw command/output bodies or promote broader durable truth.
- Deferred decision commands such as `grape add-decision` and `grape decisions review` require direct-confirmation and durable-decision data contracts before implementation.

## Required Tests

- `cli_status_snapshot`
- `cli_doctor_privacy_redacts_secrets`
- `cli_json_matches_schema`
- `cli_proofs_does_not_show_raw_secret`
- `cli_bench_requires_named_fixture`
- `cli_observed_run_records_trusted_source_without_raw_output`

Required when deferred V1.0 commands are implemented:

- `cli_add_decision_requires_confirmation`

## Beta Verification

After changing transport or package behavior, run the full local gate:

```bash
npm run beta:check
```

That runs `npm run check`, `npm run benchmark:run`, `npm run e2e:alpha`, and `npm run beta:client-trial`.

`npm run beta:client-trial` installs the packed tarball in a temporary consumer repo and proves CLI setup plus MCP stdio transport, including omission, restore, source and branch invalidation, reset, status redaction, recovery guidance, and ignored secret-looking file rejection. It does not prove a specific IDE MCP client UI. Use [`beta-trial-checklist.md`](../planning/beta-trial-checklist.md) for human client trials.
