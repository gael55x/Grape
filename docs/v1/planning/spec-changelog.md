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
- Clarified implementation planning around goal names: Documentation Foundation and Alpha Context Loop.
- Hardened supporting domain docs with schemas, transition gates, storage rules, MCP contracts, compression invalidation, tests, benchmark rules, and security gates derived from `SPEC.md`.
- Organized supporting docs into purpose-based folders while keeping `docs/v1/SPEC.md` as the canonical top-level contract.
- Added Alpha Context Loop plan to constrain the first implementation loop.
