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
- inspection: `grape sessions`, `grape artifacts`, `grape claims --active`, `grape proofs <claim_id>`, `grape stale`, `grape conflicts`, `grape omitted`
- decisions: `grape add-decision`, `grape decisions review`
- benchmarks: `grape bench`, `grape bench --fixture <name>`
- privacy: `grape doctor --privacy`, `grape export`, `grape purge`

## Implemented Setup Slice

The current implementation includes the first CLI setup/debugging slice:

- `grape help`
- `grape init --connect`
- `grape compile --task <text>`
- `grape compile --task <text> --reset-session`
- `grape artifacts`
- `grape artifacts --artifact <id>`
- `grape omitted --session <id>`
- `grape omitted --session <id> --token <restoreToken>`
- `grape status`
- `grape doctor`
- `grape mcp --print-config`
- `grape mcp --stdio`

`grape init --connect` creates the local `.grape/` layout, writes `.grape/config.json`, applies SQLite migrations to `.grape/grape.db`, captures and persists the first Git repo snapshot, persists allowed source records plus privacy-safe source rejections, persists lightweight file/symbol relationship index rows, and adds `.grape/` to `.git/info/exclude` so local Grape state is not committed.

`grape compile --task <text>` auto-bootstraps local `.grape/` state if needed, captures the current Git snapshot, persists source evidence and the lightweight file index, compiles a repository-derived context artifact with pinned active project rules and bounded exact-source evidence for selected allowed sources, runs session diffing, persists the durable context build, and writes inspectable JSON and Markdown under `.grape/artifacts/`. Supported options are `--task-type <type>`, `--risk <overlay,overlay>`, `--session <id>`, `--reset-session`, `--repo <path>`, and `--json`. Risk overlays can be detected from the task text or supplied explicitly through `--risk`; they currently return exit code `2` with an explicit unsafe reason until task-policy-specific exact-span high-risk policies are implemented.

When an explicit `--session` is reused after switching Git branches for the same task, `grape compile` keeps the session but treats the branch change as a session invalidation event. It updates the session's current branch/head metadata under the durable build lock, emits `INVALIDATE_PREVIOUS` rows for stale branch-scoped context, and does not emit `OMIT_UNCHANGED` for the previous branch's context.

When `--reset-session` is supplied for an existing compile session, `grape compile` records a session reset event, emits `INVALIDATE_PREVIOUS` rows for active prior sent items, and forces the current scaffold artifact sections to be resent instead of using `OMIT_UNCHANGED`. This is the recovery path for agents that lost prior context.

`grape artifacts` lists stored scaffold context artifacts from local SQLite metadata. `grape artifacts --session <id>` filters that list to one context session. `grape artifacts --artifact <id>` returns artifact metadata, dependency rows, warnings, unsafe reasons, and repo-relative `.grape/artifacts/` file refs. It is an inspection command; it does not claim the scaffold JSON is the final V1 artifact schema.

`grape omitted --session <id>` lists omitted context rows for a session. `grape omitted --session <id> --token <restoreToken>` validates the token against the session, stored artifact metadata, stored dependency rows, artifact hash, section content hash, dependency manifest, redaction status, current branch, head commit, worktree hash, and source/config/lockfile/rule dependency hashes before returning the omitted body. If any dependency is stale, the command exits `3` and returns stale metadata instead of sending old context.

`grape status` reports initialization, config, database, migration, branch, head commit, and worktree state. `grape doctor` reports setup diagnostics, Node runtime compatibility, migration state, dirty worktree state, and whether `.grape/` is locally excluded from Git.

`grape mcp --print-config` prints the V1 MCP connection shape for stdio clients, including `--repo <root>` and `cwd` guidance so MCP clients do not accidentally launch Grape against their own working directory. `grape mcp --stdio` serves the first MCP adapter with `grape_get_context`, `grape_get_artifact`, `grape_get_omitted_item`, and `grape_get_status`; the context tool reuses the local compile service and currently returns scaffold context-pack item shapes until the final V1 artifact schema is implemented.

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

- `grape proofs <claim_id>` shows proof refs, scope, verification status, and stale/contradiction status. It must not show raw secrets.
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
