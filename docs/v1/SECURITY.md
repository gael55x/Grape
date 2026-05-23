# V1 Security

## Purpose

Define privacy, ignored-file, redaction, and local-first security rules.

## Required Contents

- local-first rule
- ignored file policy
- explicit approval behavior
- secret scan rules
- proof excerpt redaction
- artifact-level scan rules
- security tests

## Readers

Security, evidence, storage, compiler, MCP, CLI, and test implementers.

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
