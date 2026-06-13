# Grape Documentation

This folder contains committed documentation for Grape.

Grape 1.0 beta (`grape-context@1.0.0-beta.0`) is published on npm under the `beta` dist-tag. User-facing install and session docs live in the root [`README.md`](../README.md) and [`v1/interfaces/`](v1/interfaces/). Grape includes benchmark fixtures and scripts for local comparison. Formal benchmark comparison runs are the next validation phase after this publish.

## Active Docs

- [V1 documentation](v1/README.md)
- [V1 canonical implementation contract](v1/SPEC.md)

## Future And Historical Docs

- [V2 planning](v2/README.md) is future planning only.
- [Alpha era legacy](v1/legacy/alpha/README.md) is historical alpha documentation only.
- [Archive](archive/README.md) redirects to the legacy index.

## Source-Of-Truth Rules

- `docs/v1/SPEC.md` is the canonical committed V1 implementation contract.
- Supporting V1 docs are grouped by purpose under `docs/v1/`.
- `do-not-commit-docs/` is private planning material and must not be committed.
- If supporting docs conflict with `docs/v1/SPEC.md`, stop and reconcile the docs before coding.
