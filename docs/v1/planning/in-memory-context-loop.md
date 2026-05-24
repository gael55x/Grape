# In-Memory Context Loop

## Goal

Prove the smallest safe in-memory Grape loop without building broad product surface area.

This goal must show that Grape can shape and validate:

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

## Path

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
- Durable SQLite storage.
- SQLite optimization.
- Tree-sitter or full symbol graph.
- Embeddings or model summaries.
- Multi-repo support.
- Dirty worktree support beyond explicit "not handled in alpha" warning.
- High-risk task support beyond proving exact pinned rule behavior.

## Work Tickets

| Ticket | Scope | Docs | Required tests | Exit criteria |
|---|---|---|---|---|
| `memory-01` | Create fixture metadata for `clean-typescript-app`. | `fixtures/README.md`, this file | fixture metadata validation | complete |
| `memory-02` | Add shared TypeScript contract shapes. | `SPEC.md`, `contracts/`, `core/` docs if changed | contract value check | complete |
| `memory-03` | Add state/event skeleton. | `architecture/state-machine.md` | transition table smoke test | complete |
| `memory-04` | Add repo snapshot interface. | `core/storage.md`, `architecture/overview.md` if changed | clean snapshot shape check | complete |
| `memory-05` | Add evidence/proof/claim interfaces. | `core/trust-model.md` if changed | trust shape check | complete |
| `memory-06` | Add current-valid filtering skeleton. | `core/trust-model.md` if changed | current-valid smoke check | complete |
| `memory-07` | Add context artifact shape guard. | `contracts/context-artifact.md` if changed | artifact manifest smoke check | complete |
| `memory-08` | Add context diff proof skeleton. | `contracts/context-diff.md` if changed | first-turn/second-turn diff checks | pack items emitted with session scope and unsafe omission count |
| `memory-09` | Add in-memory token accounting baseline. | `quality/benchmarks.md` | benchmark fixture smoke check | first-turn and later-turn token metrics defined |

## Quality Gates

- No production behavior without a named state transition.
- No durable claim without proof refs.
- No context artifact without dependency manifest.
- No omitted context item without restore metadata or safe omission reason.
- No high-risk exact section replaced by summary.
- No generated context returned from ignored/private files.
- No code path treats `current-valid` as relevance ranking.

## Completed Work

- `memory-01`: added `tests/fixtures/clean-typescript-app`, fixture metadata, fixture docs, and `npm run fixtures:check`.
- `memory-02`: added shared TypeScript contract shape exports and the shared-contract checks in `npm run memory:check`.
- `memory-03`: added the state/event skeleton and transition table smoke checks in `npm run memory:check`.
- `memory-04`: added the repo snapshot shape and clean fixture snapshot smoke check.
- `memory-05`: added evidence/proof/claim shapes and trust-shape checks.
- `memory-06`: added current-valid filtering skeleton and consolidated in-memory loop smoke checks under `npm run memory:check`.
- `memory-07`: added context artifact shape guards for dependency manifests, section hashes, blocked redaction, dependency refs, exact source refs, and exact active-claim proof refs.

## Exit Criteria

- `clean-typescript-app` fixture expectations are documented.
- Shared contract shapes are checked by the in-memory harness.
- In-memory workflow can be executed through application service tests.
- First turn returns structured `ContextPackItem[]`.
- Second no-change turn omits unchanged non-pinned context safely.
- Pinned rules are resent.
- Stale dependency test fails closed.
- Token metrics report first-turn and later-turn costs separately.

## What Comes After

After In-Memory Context Loop passes, continue to Project Skeleton And Tooling, SQLite Schema And Migrations, and the later Alpha Product Slice.
