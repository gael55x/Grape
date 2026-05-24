# V1 Changelog

This file tracks implementation-facing V1 changes.

User-facing release notes belong in the root `CHANGELOG.md`. Spec-contract changes belong in `spec-changelog.md`.

## Unreleased

### Added

- Initial V1 documentation architecture.
- Committed canonical V1 implementation contract at `docs/v1/SPEC.md`.
- Implementation planning now uses goal names: Documentation Foundation, In-Memory Context Loop, and Alpha Product Slice.
- Expanded implementation contracts for architecture, state machine, trust, artifact, diff, compression, MCP, CLI, storage, testing, benchmarks, security, fixtures, examples, and invariants.
- Organized V1 supporting docs into purpose-based folders under `architecture/`, `core/`, `contracts/`, `interfaces/`, `quality/`, and `planning/`.
- Added In-Memory Context Loop plan with scoped work tickets and exit criteria.
- Added minimal project skeleton with package metadata, TypeScript config, docs structure guard, and shared canonical contract types.
- Added `clean-typescript-app` fixture with metadata hash validation.
- Added shared contract and state-machine skeleton validation scripts.
- Added repo snapshot shape and clean fixture snapshot smoke check.
- Added evidence, proof, and durable claim shapes with trust-shape validation.
- Added current-valid filtering skeleton and consolidated In-Memory Context Loop smoke checks.
- Tightened repo snapshot and current-valid shapes to reject placeholder hashes and missing proofs.
- Added context artifact builder skeleton with manifest, section hash, dependency-ref, exact-context, and blocked-redaction guards.
- Added in-memory context diff proof for safe omission, restore metadata, pinned resend, and unsafe omission counting.
