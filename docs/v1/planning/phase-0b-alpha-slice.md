# Phase 0B Alpha Slice

## Goal

Prove the smallest safe end-to-end Grape loop without building broad product surface area.

The alpha slice must show that Grape can:

```text
repo snapshot
-> evidence record
-> proof-backed claim
-> current-valid retrieval
-> context artifact
-> session-scoped context diff
-> structured context pack
```

## Fixture

Use one fixture first: `clean-typescript-app`.

The fixture must include:

- one clean Git branch
- one source file
- one test file
- one project rule file
- one simple task request
- expected source hashes
- expected proof-backed claim
- expected context artifact sections
- expected first-turn and second-turn context pack items

## Alpha Path

1. Detect repo root, branch, commit, and clean worktree state.
2. Hash allowed source files.
3. Record evidence for source file, test file, and project rule.
4. Create one claim candidate from deterministic extraction.
5. Attach and validate one exact proof span.
6. Persist one durable claim only after proof and scope validation.
7. Resolve current-valid context for the current branch/worktree.
8. Compile a `ContextArtifact` with dependency manifest.
9. Generate first-turn context diff with `NEW` and `PINNED` items.
10. Generate second-turn no-change diff with safe `OMIT_UNCHANGED` and restore metadata.

## Non-Goals

- MCP server transport.
- Full CLI.
- Compression cache.
- SQLite optimization.
- Tree-sitter or full symbol graph.
- Embeddings or model summaries.
- Multi-repo support.
- Dirty worktree support beyond explicit "not handled in alpha" warning.
- High-risk task support beyond proving exact pinned rule behavior.

## Work Tickets

| Ticket | Scope | Docs | Required tests | Exit criteria |
|---|---|---|---|---|
| `P0B-01` | Create fixture metadata for `clean-typescript-app`. | `fixtures/README.md`, this file | fixture metadata validation | expected labels and hashes documented |
| `P0B-02` | Add shared TypeScript contract types. | `SPEC.md`, `contracts/`, `core/` docs if changed | type compile smoke test | canonical enums and schemas exported |
| `P0B-03` | Add state/event skeleton. | `architecture/state-machine.md` | transition table smoke test | no undocumented transition names |
| `P0B-04` | Add repo snapshot interface. | `core/storage.md`, `architecture/overview.md` if changed | clean snapshot unit test | branch/commit/worktree hash shape defined |
| `P0B-05` | Add evidence/proof/claim interfaces. | `core/trust-model.md` if changed | no-proof and proof-hash unit tests | durable claim cannot exist without proof refs |
| `P0B-06` | Add current-valid filtering skeleton. | `core/trust-model.md` if changed | scope match/mismatch tests | scope mismatch excluded before ranking |
| `P0B-07` | Add context artifact builder skeleton. | `contracts/context-artifact.md` if changed | artifact manifest golden test | artifact requires manifest and section hashes |
| `P0B-08` | Add context diff skeleton. | `contracts/context-diff.md` if changed | first-turn/second-turn diff tests | `ContextPackItem[]` emitted with session scope |
| `P0B-09` | Add alpha benchmark definition. | `quality/benchmarks.md` | benchmark fixture smoke test | first-turn and later-turn token metrics defined |

## Quality Gates

- No production behavior without a named state transition.
- No durable claim without proof refs.
- No context artifact without dependency manifest.
- No omitted context item without restore metadata or safe omission reason.
- No high-risk exact section replaced by summary.
- No generated context returned from ignored/private files.
- No code path treats `current-valid` as relevance ranking.

## Exit Criteria

- `clean-typescript-app` fixture expectations are documented.
- Shared contracts compile.
- Alpha workflow can be executed through application service tests.
- First turn returns structured `ContextPackItem[]`.
- Second no-change turn omits unchanged non-pinned context safely.
- Pinned rules are resent.
- Stale dependency test fails closed.
- Token metrics report first-turn and later-turn costs separately.

## What Comes After

After Phase 0B passes, continue to Phase 1 project skeleton/tooling hardening and then Phase 2 storage/migrations.
