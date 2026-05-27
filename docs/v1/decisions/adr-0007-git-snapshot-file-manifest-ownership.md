# ADR-0007: Git Snapshot File Manifest Ownership

## Status

Accepted.

## Context

The Git snapshot path must remain small and inspectable because it is a trust boundary for branch identity, worktree identity, file evidence, and privacy-safe source rejection records.

Scanner safety checks for oversized and binary-looking files added a second responsibility to `src/core/git/repo-snapshot.ts`: file-byte read policy and rejection metadata. Keeping that logic inside the Git orchestration file would make future scanner changes harder to review and would push the file past the documented 300-line review checkpoint.

## Decision

Split file manifest behavior into `src/core/git/file-manifest.ts`.

`repo-snapshot.ts` owns Git command orchestration, branch/head discovery, dirty-path filtering, tracked/visible path discovery, and deterministic snapshot/worktree hashes. `file-manifest.ts` owns per-file read gates, source-kind classification, content hashing, oversized-file rejection, binary-looking-file rejection, unreadable-file rejection, and privacy-safe rejection metadata.

Public exports still flow through `src/core/git/index.ts`.

## Consequences

Scanner policy can evolve without expanding Git command orchestration. Tests can import `maxSnapshotFileBytes` through the git module boundary, and future file-read safety changes have an obvious owner.

The split does not change the V1 product contract. It only clarifies implementation ownership and keeps scanner behavior modular.

## Alternatives

- Keep all scanner behavior in `repo-snapshot.ts`. Rejected because the file would own both Git orchestration and file-byte policy and was already past the review checkpoint.
- Move scanner gates into `src/core/security/`. Rejected because security owns ignore/redaction policy, while snapshot file hashing and source-kind classification are Git snapshot implementation details.
- Add a generic shared file utility. Rejected because this behavior is domain-specific and should not become a dumping ground.

## Supersedes

None.

## Related Spec Sections

- `docs/v1/SPEC.md` section 4: evidence, proof, and source grounding requirements.
- `docs/v1/SPEC.md` section 7: runtime state and storage.
- `docs/v1/core/security.md`: privacy, ignored-file, and scanner rejection behavior.
- `docs/v1/core/trust-model.md`: source records and source rejection records.
- `docs/v1/architecture/overview.md`: module boundaries and code modularity standards.
