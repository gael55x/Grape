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

## Implementation status (1.0 beta)

| Workflow | Status |
|---|---|
| Git/local ignore filtering, snapshot rejection, artifact secret scan, `.grape/` exclusion | **Implemented** |
| Ignored/private read approval workflow (`audit_events`, scoped approval) | **Partial** (doctor/status diagnostics; full approval UX deferred) |
| `grape export` / `grape purge` privacy workflows | **Deferred** (specified in CLI contract; no runnable command yet) |
| Complete redaction engine beyond baseline artifact scan | **Partial** |

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

Git repo snapshots also reject oversized files and binary-looking files before they become source records. Oversized rejections store path, reason, source kind, and size only; binary rejections store path, reason, source kind, size, and a content hash, but no raw bytes. CLI setup/status output exposes aggregate scan diagnostics so developers and agents can see why files were skipped without receiving file bodies.

`grape doctor --privacy` exposes the same privacy posture as diagnostics only: local-first defaults, `.grape/` Git exclusion, aggregate scanner rejection counts, ignored/private rejection handling, and artifact secret-scan coverage. It does not approve ignored/private reads, export raw local data, purge local data, or reveal rejected-file contents.

The current file-indexing foundation reads only files already present in the allowed snapshot file manifest. Before provider-backed symbol/import extraction or safe lexical fallback, it normalizes repository separators, rejects traversal or drive-qualified repo paths, and rejects symlinks, binary files, oversized files, unreadable files, and files whose current bytes no longer match the snapshot hash. It stores module/symbol names, import refs, hashes, line numbers, confidence, and discovery method, but not source excerpts or file contents.

The current lexical search foundation reads only already-allowed source records, reuses the same path, size, symlink, binary, and source-hash guards as file indexing, and skips secret-looking text before inserting search rows. Search result records expose source refs and hashes, not indexed bodies.

The current CLI compile path runs a basic artifact-level secret scan before writing JSON or Markdown artifacts. The scanner blocks obvious raw secret assignments, structured secret-looking JSON/YAML fields, private-key blocks, common API token families, credentialed database URLs, and AWS access-key IDs. Plain references to environment variables, such as `process.env.OPENAI_API_KEY`, are not treated as raw secret values by themselves. This is a baseline artifact guard, not a complete redaction engine or proof-span scanner.

Exact source evidence excerpts are read only from source records that were already allowed by Git ignore and local privacy ignore filtering. The local reader rejects unsafe repo-relative paths, verifies the current bytes still match the stored source hash, skips binary-looking content, and bounds excerpt size before the artifact-level secret scan runs.

Local Grape runtime state under `.grape/artifacts/`, `.grape/cache/`, `.grape/context/`, `.grape/logs/`, `.grape/tmp/`, `.grape/config.json`, and `.grape/grape.db*` is rejected as private runtime state even if a repository has accidentally made those paths Git-visible. The local `.grape/` layout and its owned subdirectories must be real directories inside the repository root, not symlinks to external locations. Read-only status/doctor paths must also validate existing local state before reading config or database files; a symlinked `.grape/`, config, or database path is reported as unsafe local state instead of being followed.

Repository files, docs, comments, rule files, and generated context excerpts are untrusted input when they are delivered to an AI agent. Grape separates metadata from repository content where possible, but it cannot make malicious source text safe to follow as instructions. Exact source excerpts and rule excerpts are rendered in dynamically sized Markdown fences labeled as untrusted repository evidence, so repository-authored triple-backtick text cannot break out of the evidence block and become agent instructions. Users and MCP clients should review generated context before pasting or forwarding it to an LLM, especially for private repositories, security-sensitive tasks, and context that includes human-authored rules or Markdown.

Bootstrap detection reads only common root manifest/config files such as `package.json`, lockfiles, `tsconfig.json`, framework config files, and conventional entry point paths. It reports script names and derived commands such as `pnpm test`, not raw script bodies, and candidate rules remain non-durable hints until a user confirms them.

Restricted MCP write tools run the same baseline secret scan over caller-provided command/candidate/decision/confirmation text before persistence. Source metadata stores hashes and scope only; raw command output, prompt, response, and candidate evidence bodies are not returned over MCP.

## Public Output Sanitization

All CLI and MCP public output is sanitized by default before it is written to stdout, stderr, or MCP `structuredContent` / summary text. Repo-scoped CLI commands sanitize against the active repository root from `--repo <path>` or the current working directory, replace that root with `<repo-root>`, handle common local path aliases for the same root, redact other local absolute path shapes, and redact common token/API-key/private-key/password-looking values and sensitive object fields. This boundary applies to human output, JSON output, MCP tool results/errors, benchmark reports, artifact inspection responses, restore/reset/mismatch diagnostics, and runtime failures.

Sanitization is a final public-output boundary, not permission to store unsafe raw values internally. Storage, proof, artifact, source-excerpt, and benchmark paths must still avoid raw secrets and private local content at their own boundaries. Any future raw/debug mode must be opt-in, documented, and safe by default.

## Redaction And Hash Rules

- Source hashes are computed from original source bytes.
- Excerpt hashes are computed from exact source spans before redaction.
- Redacted display hashes are computed from redacted text and are not proof hashes.
- Raw secrets must not be stored in sources, proofs, artifacts, lexical search entries, logs, examples, fixtures, or benchmark outputs.
- If a proof span contains a secret and cannot be safely redacted while preserving support, the proof is blocked.
- If an artifact section fails a secret scan, the artifact becomes `unsafe_compile` or the section is omitted with an explicit blocked reason.

## Local-First Rule

V1 must not send repository content, proofs, artifacts, embeddings, telemetry, or summaries to a remote service by default. Any future remote behavior requires V1.1/V2 scope, opt-in config, security docs, and an ADR.

This local-first rule covers Grape's own behavior. The user's MCP client, editor, or coding agent may forward returned context to its model provider. Grape output should be treated like any other repository context given to an AI tool.

Manual cleanup while `grape purge` is deferred:

```bash
rm -rf .grape
grape init --connect
```

This removes local Grape state for that repository and recreates setup state. It does not change source files or Git history.

New local configs include retention defaults for context artifacts, snapshots, FTS rows, compression inputs, derived metadata, and invalidated records. Existing schema-1 configs without the retention block still read with those defaults. Until `grape compact` is implemented, these values are documented limits for cleanup policy, not background deletion.

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
- `public_output_sanitizes_local_paths_and_secret_like_values`
- `status_refuses_symlinked_local_state`
- `repository_text_is_rendered_as_untrusted_evidence`
