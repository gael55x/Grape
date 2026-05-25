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
- `grape status`
- `grape doctor`
- `grape mcp --print-config`

`grape init --connect` creates the local `.grape/` layout, writes `.grape/config.json`, applies SQLite migrations to `.grape/grape.db`, captures and persists the first Git repo snapshot, and adds `.grape/` to `.git/info/exclude` so local Grape state is not committed.

`grape status` reports initialization, config, database, migration, branch, head commit, and worktree state. `grape doctor` reports setup diagnostics, Node runtime compatibility, migration state, dirty worktree state, and whether `.grape/` is locally excluded from Git.

`grape mcp --print-config` prints the V1 MCP connection shape for stdio clients. The actual `grape mcp --stdio` server remains pending until the product context compile path is implemented.

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
