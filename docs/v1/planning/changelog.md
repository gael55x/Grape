# V1 Changelog

This file tracks implementation-facing V1 changes.

User-facing release notes belong in the root `CHANGELOG.md`. Spec-contract changes belong in `spec-changelog.md`.

## Unreleased

### Added

- Initial V1 documentation architecture.
- Committed canonical V1 implementation contract at `docs/v1/SPEC.md`.
- Phase 0 split into `Phase 0A` documentation hardening and `Phase 0B` alpha vertical slice.
- Expanded implementation contracts for architecture, state machine, trust, artifact, diff, compression, MCP, CLI, storage, testing, benchmarks, security, fixtures, examples, and invariants.
- Organized V1 supporting docs into purpose-based folders under `architecture/`, `core/`, `contracts/`, `interfaces/`, `quality/`, and `planning/`.
- Added Phase 0B alpha-slice plan with scoped work tickets and exit criteria.
- Added minimal project skeleton with package metadata, TypeScript config, docs structure guard, and shared canonical contract types.
- Added `clean-typescript-app` fixture with metadata hash validation.
- Added shared contract and state-machine skeleton validation scripts.
