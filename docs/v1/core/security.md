# V1 Security

## Purpose

Define privacy, ignored-file, redaction, and local-first security rules.

## Source Of Truth

Security rules implement the local-first and privacy contract in `docs/v1/SPEC.md`.

## Update Triggers

- ignore policy changes
- redaction behavior changes
- artifact/proof persistence changes
- MCP/CLI reads private files

## Agent Checks

Before editing security-sensitive code, agents must verify:

- ignored/private files are not read silently
- raw secrets are not persisted
- proof hashes remain tied to canonical source spans
- artifacts are scanned before storage and return

## Non-Negotiable Rules

- No cloud sync in V1.
- No telemetry by default.
- No remote embeddings by default.
- Raw `.env` values must never be included in context artifacts.
- Secret excerpts are redacted or blocked.

## Ignored And Private File Policy

- Respect `.gitignore`, `.ignore`, tool-specific ignore files, and Grape's local privacy config.
- Ignored/private files are not indexed, searched, summarized, used as proof, or returned unless explicitly approved.
- Approval must be scoped to repo, path pattern, purpose, session or durable duration, and timestamp.
- Approval records go to `audit_events` and must be visible through doctor/status inspection.
- A one-time approval cannot become durable approval without direct user confirmation.

Current implementation note: Git repo snapshots filter paths through Git ignore rules and local privacy ignore files before reading file bytes for hashes. The local privacy ignore baseline currently covers `.ignore`, `.cursorignore`, `.aiignore`, and `.grapeignore` with conservative pattern support. Negated unignore rules are intentionally not supported in this slice because false inclusion is riskier than skipping an extra file.

Rejected ignored/private paths are persisted only as path-level `source_rejections` with reason, privacy status, repo snapshot identity, and hashes of allowed inputs. Grape does not read or persist the rejected file contents. Git-ignored untracked files and directories are skipped by default rather than enumerated, which avoids storing local-only path names such as ignored environment files, dependency folders, and `.grape/` runtime files.

## Redaction And Hash Rules

- Source hashes are computed from original source bytes.
- Excerpt hashes are computed from exact source spans before redaction.
- Redacted display hashes are computed from redacted text and are not proof hashes.
- Raw secrets must not be stored in sources, proofs, artifacts, FTS entries, logs, examples, fixtures, or benchmark outputs.
- If a proof span contains a secret and cannot be safely redacted while preserving support, the proof is blocked.
- If an artifact section fails a secret scan, the artifact becomes `unsafe_compile` or the section is omitted with an explicit blocked reason.

## Local-First Rule

V1 must not send repository content, proofs, artifacts, embeddings, telemetry, or summaries to a remote service by default. Any future remote behavior requires V1.1/V2 scope, opt-in config, security docs, and an ADR.

## Logging Rules

- Logs use structured event names and IDs.
- Logs may include hashes, IDs, counts, and statuses.
- Logs must not include raw source excerpts from ignored/private files or detected secrets.
- Error messages should identify blocked behavior without revealing secret values.

## Required Tests

- `ignored_file_not_indexed_without_approval`
- `ignored_file_rejection_does_not_store_raw_content`
- `private_file_approval_is_scoped`
- `private_file_rejection_does_not_store_raw_content`
- `one_time_approval_not_durable`
- `raw_env_value_not_in_artifact`
- `redacted_display_hash_not_used_as_proof`
- `proof_with_unredactable_secret_is_blocked`
- `artifact_secret_scan_failure_is_unsafe_compile`
- `logs_do_not_include_raw_secret`
