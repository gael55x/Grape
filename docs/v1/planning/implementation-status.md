# V1 Implementation Status

This matrix tracks implementation against the final V1 core-pipeline acceptance areas. It is an implementation aid, not a substitute for working code, tests, docs, review, and pushed commits.

Status values:

- Not started
- In progress
- Implemented
- Tested
- Documented
- Reviewed
- Done

| Area | Status | Current evidence | Remaining work |
|---|---|---|---|
| CLI setup flow | Tested | `grape init --connect`, `grape help`, `grape status`, `grape doctor`, and `grape mcp --print-config` have a thin CLI adapter and behavior tests. | Broaden CLI inspection commands after artifact/query flows exist. |
| Local bootstrap | Tested | `grape init --connect` creates `.grape/`, writes config, applies SQLite migrations, persists a Git snapshot, persists source/source-rejection evidence rows, and excludes `.grape/` through `.git/info/exclude`. | Add bootstrap artifact generation, candidate rules, framework/package-manager detection, and recovery tests for partial bootstrap. |
| Project scanner | Tested | Git-backed snapshot captures branch, commit, dirty paths, Git-visible files, file hashes, source-kind classification, Git-visible ignored/private path rejections, `.gitignore`, and local privacy ignore files before reading allowed file bytes. Ignored untracked paths are skipped rather than enumerated. | Add size/binary handling, approval records, staged/untracked source-scope splitting, and explicit scan diagnostics. |
| File indexing | Not started | Git-visible file manifest exists in repo snapshots. | Add FTS/source indexes and searchable file/rule entries without raw secret persistence. |
| Dependency tracking | Tested | Durable context build persists artifact dependency manifests and invalidates stale sent items when manifest hashes change. | Connect dependencies to real source/proof/rule/config inputs from repository scans. |
| Branch awareness | Tested | Repo snapshots persist branch, head commit, dirty state, worktree hash, and sent ledgers include branch/commit identity. | Add branch-switch invalidation across active context sessions and current-valid claim filtering. |
| Session diffing | Tested | Durable build proof persists session-scoped sent/omitted ledgers, safe unchanged omission, restore metadata, pinned resend, and stale manifest invalidation. | Add restore lookup command/tool and session reset/branch-switch behavior in product flow. |
| Task-specific context pack generation | In progress | In-memory artifact shape and durable build proof exist for already-built artifacts. | Build repository-derived compiler policies, risk overlays, exact-span selection, and dual JSON/Markdown artifact files from real input. |
| Proof/evidence model | Tested | Shared trust/proof/evidence shapes exist; snapshot source ingestion persists allowed source records and privacy-safe source rejections without reading rejected bytes. | Implement proof validation, belief gate, candidate rejection, durable promotion rules, and exact proof-span support. |
| Context artifact format | In progress | In-memory artifact guards require dependency manifests, section hashes, dependency refs, exact source refs, proof refs for exact claims, and blocked-redaction rejection. | Promote to final V1 artifact schema and persist JSON/Markdown under `.grape/artifacts/`. |
| MCP integration surface or contract | Documented | `grape mcp --print-config` returns an explicit `contract_only` stdio server shape and states that the server is not implemented yet. | Implement stdio MCP server and `grape_get_context` once the product compile path exists, then switch the output to a usable MCP client config. |
| Doctor/status/debug commands | Tested | `grape status` and `grape doctor` inspect config, database, migrations, Git state, Node runtime, worktree state, and local privacy exclusion. | Add sessions/artifacts/claims/proofs/stale/conflicts/omitted commands as those records become product-facing. |
| Error handling | In progress | CLI commands return documented exit codes for usage/storage/stale states, and doctor reports setup failures. | Add recovery guidance for partial bootstrap, lock conflicts, unsafe compile, missing git metadata, and privacy blocks. |
| Cross-platform behavior | In progress | Core paths normalize separators, Git commands use `execFileSync` args, setup uses Node filesystem APIs, and tests use real temp repos. | Add Windows/WSL path tests and avoid Node runtime assumptions beyond the accepted Node 22.5 SQLite ADR. |
| Tests | Tested | `npm run check` includes docs, fixtures, memory, architecture, storage, typecheck, and 44 behavior tests including CLI bootstrap and evidence source persistence. | Add compiler/retrieval/MCP artifact-shape tests as those slices are implemented. |
| Documentation | Documented | CLI, README, roadmap/log/changelog, architecture, storage, security, trust, and this status matrix are updated for the setup/evidence slices. | Keep docs aligned as each core-pipeline slice lands. |
| Known limitations | Documented | Current docs state CLI setup and snapshot source persistence exist, but product context generation, proof promotion, staged/untracked scope splitting, and MCP stdio transport remain pending. | Revisit after each slice; do not mark Done until limitations are narrowed to acceptable V1. |
| Final human-review readiness | In progress | Repository has clean modular slices, passing checks, and incremental status tracking. | Not ready until end-to-end V1 context generation, MCP/CLI consumption, evidence/proof-backed artifacts, and hardening are implemented, tested, documented, reviewed, committed, and pushed. |
