# V1 Spec Changelog

This file records changes to the V1 implementation contract.

Each entry should include:

- date
- changed section
- reason
- affected docs
- affected tests
- migration or benchmark impact, if any

## Unreleased

- Established public V1 documentation architecture derived from the canonical V1 contract.
- Published the canonical V1 implementation contract as `docs/v1/SPEC.md` so future implementation does not depend on ignored planning files.
- Clarified implementation planning around goal names: Documentation Foundation, In-Memory Context Loop, and Alpha Product Slice.
- Hardened supporting domain docs with schemas, transition gates, storage rules, MCP contracts, compression invalidation, tests, benchmark rules, and security gates derived from `SPEC.md`.
- Organized supporting docs into purpose-based folders while keeping `docs/v1/SPEC.md` as the canonical top-level contract.
- Added In-Memory Context Loop plan to constrain the first implementation loop.
- Aligned supporting storage table names with canonical `SPEC.md` names where present.
- Added the first alpha storage migration contract for project, repo, source, claim, proof, artifact, and session-ledger tables.
- Hardened the alpha storage contract with SQL checksum validation, serialized-state constraints, session branch/worktree identity, dependency manifest hashes, and complete sent/omitted ledger fields.
- Selected Node 22.5+ built-in `node:sqlite` for the initial runtime migration path to avoid native SQLite package installation.
- Made Node 22.5+ the canonical V1 runtime and added ADR-0004 for the no-native SQLite runtime decision.
- Tightened the storage contract so sent, omitted, and pack ledger rows must reference artifacts owned by the same session.
- Tightened restorable omission storage so restore metadata, branch/commit identity, dependency manifest hash, send count, and token count are persisted.
- Added runtime migration bootstrap protection for non-empty databases without trusted migration metadata.
- Added Durable Context Build Proof as the next implementation goal before CLI/MCP product transport.
- Added code modularity standards with split checkpoints to prevent godfiles and generic utility modules.
- Extended storage dependency kinds for persisted artifact manifests that include repo snapshot, worktree state, and session ledger dependencies.
- Extended the repo snapshot implementation contract with dirty paths, deterministic snapshot hashes, Git-visible file hashing, ignored-file exclusion, and symlink hashing without following symlink targets.
- Clarified the implementation contract for snapshot-derived evidence storage: allowed files become source records, rejected ignored/private/unreadable paths become source-rejection records, and rejected file contents remain unread.
- Added an explicit implementation need for `symbol_nodes` and `symbol_edges` through `0002_indexing_foundation.sql` so V1 has persisted file relationship tracking before repository-derived artifact compilation.
- Clarified the current repository-derived compiler foundation as an in-memory artifact scaffold that consumes persisted snapshot/source/index records without claiming final V1 artifact output.
- Clarified the CLI compile scaffold output path: current JSON/Markdown files are inspectable `InMemoryContextArtifactShape` artifacts, not the final V1 artifact schema.
- Clarified the first MCP stdio implementation status: `grape_get_context` and `grape_get_status` are implemented against the scaffold compile/status services while the full V1 MCP tool surface and final artifact schema remain pending. The current MCP context tool requires `sessionId` or `agentSessionId`, returns repo-relative artifact file refs, and marks unsupported seed/budget narrowing as partial risk.
- Clarified the omitted restore scaffold contract: CLI `grape omitted` and MCP `grape_get_omitted_item` restore only session-scoped omitted scaffold sections after validating token ownership, stored artifact identity, artifact hash, stored dependency rows, section hash, dependency manifest, redaction status, branch, commit, worktree hash, and source/config/lockfile/rule dependency hashes.
