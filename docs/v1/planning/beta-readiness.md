# Beta Readiness Checklist

## Purpose

Track the work required to move from the alpha transport proof to serious human pre-beta review.

This checklist does not expand V1 scope. It makes the current transport slice easier to install, connect, verify, and recover from.

The beta product promise is: install Grape, keep using the coding agent normally, and let MCP `grape_get_context` drive agent-called session tracking: safe deltas, pinned safety context, stale invalidation, and restorable omissions when the agent calls Grape with stable session identity each turn.

Use [`beta-trial-checklist.md`](beta-trial-checklist.md) for real MCP client trials and pass/fail criteria.

## Product Engineering Ledger

| Learned fact | Repo evidence | Beta impact | Decision made | Next action | Open risk |
|---|---|---|---|---|---|
| The package dry-run check used a fixed migration list and missed the latest storage migration. | `src/core/storage/migrations/0006_claim_edge_authority.sql`; commit `80f73cc` updates `scripts/check-package.mjs`. | A tarball could pass the package gate while missing a migration needed by a beta user's local database. | Make the package check derive required migration files from source. | Keep package checks green while closing higher-risk gates. | Future generated files may need the same source-to-dist coverage check. |
| Common-language fallback proof now covers more realistic mixed-language files. | `src/core/indexing/index-paths.ts`; `tests/fixtures/polyglot-fallback-repo`; `tests/behavior/retrieval/polyglot-monorepo-fallback.test.mjs`. | A beta user on a mixed-language repo gets exact source evidence and visible fallback limits instead of silent confidence. | Label common fallback languages, keep exact-path tasks narrow, and render selected fallback languages in artifact warnings. | Reassess MCP client trial and token-quality blockers next. | Real parsing beyond TS/JS remains planned and should not be implied. |
| The MCP frame parser accepted malformed `Content-Length` values through partial number parsing. | `src/mcp/protocol.ts`; `tests/behavior/mcp/mcp-stdio.test.mjs`. | A beta MCP client should get a clear parse error for malformed frames, not a misleading partial-body JSON error. | Require all-digit `Content-Length` values before reading a frame body. | Keep MCP stdio contract tests green while preparing real client trials. | Real Cursor or Claude Code client trials still need human-owned runs. |
| Some status docs still named polyglot and monorepo fixtures as pending after behavior proof landed. | README, roadmap, CLI/MCP docs, implementation status, fixture docs, and language-indexing docs. | A beta reviewer could think Grape lacks fallback proof that tests now provide, or could expect graph support that still is not shipped. | Align docs around proven safe fallback and explicit package-path scoping only. | Keep remaining blocker language focused on real MCP client trials, package-aware invalidation, and benchmarks. | Historical logs still mention earlier fixture gaps as past work notes. |
| The global package smoke script hardcoded the alpha.3 package version. | `scripts/check-global-install-smoke.mjs`; `package.json`. | A future beta version bump could leave the smoke checking the wrong global package. | Read package name and version from `package.json`, matching install and e2e smoke scripts. | Keep global smoke available for human-owned published-package checks. | The smoke still requires the expected package to be installed globally before it runs. |
| Debug-only MCP warnings made safe compact packs look partially risky. | `src/mcp/get-context.ts`; `tests/behavior/mcp/mcp-stdio.test.mjs`; `docs/v1/contracts/transport-stability.md`. | A beta MCP agent could overreact to a normal lightweight-index notice and treat usable context as risky. | Filter debug-only warnings from default `agent_pack` and keep them from changing `compileMode`; keep full/artifact output inspectable. | Continue with real MCP client trials and package/token-quality blockers. | Stored artifacts still expose lightweight-index limits, which is correct until broader graph support ships. |
| Some repository artifact sections depended on indirect content/hash changes instead of explicit worktree scope. | `src/core/compiler/repository/sections/builders/*`; `tests/behavior/compiler/repository-context-artifact.test.mjs`; `tests/behavior/contracts/context-transport-coverage.test.mjs`. | A dirty beta worktree must not let any previously sent section omit stale context because that section lacked a worktree dependency. | Require repository-derived sections to carry `repo-snapshot` and `worktree-state` dependency refs. | Continue with client trials, package-aware invalidation, and scan-bound work. | Dirty worktree transport remains conservative and may resend more than ideal. |
| Lexical punctuation fallback could scan every stored text row after the SQL prefilter underfilled. | `src/core/storage/indexing/fts-repositories.ts`; `tests/behavior/indexing/fts-search.test.mjs`; `docs/v1/core/retrieval.md`; `docs/v1/core/storage.md`. | A serious beta repo could pay broad storage cost for one small lexical search term. | Bound the normalized fallback scan while preserving deterministic punctuation-insensitive matching within the fallback window. | Reassess ledger bounds and real MCP client trials next. | Broad non-TS/JS retrieval still depends on safe lexical fallback rather than language-aware graph facts. |
| Compile-time ledger reads loaded full session history even though only latest active rows can affect the next pack. | `src/core/storage/context-ledger/repositories.ts`; `src/app/durable-context-build.ts`; `src/app/local-project/context/context-pack-summary.ts`; `tests/behavior/storage/context-ledger-repositories.test.mjs`. | Long-lived beta sessions could pay for obsolete sent rows and let old same-section rows confuse diff inputs. | Add storage helpers that return latest non-invalidated sent rows per section and matching active pack payloads, then route compile-time reads through them. | Reassess real MCP client trials and cross-platform CI next. | Explicit inspection commands still read full history by design. |
| CI only ran the beta gate on Ubuntu. | `.github/workflows/check.yml`; package scripts in `package.json`. | A beta package can fail on macOS or Windows even when Linux passes. | Run `npm run check` across Ubuntu, macOS, and Windows, and keep benchmark/e2e smoke on Ubuntu to avoid multiplying benchmark cost. | Watch the first remote matrix run and fix platform-specific failures. | Local work cannot prove hosted macOS/Windows runners until GitHub Actions runs. |
| Generic fallback symbols were mostly JS-shaped even though fallback fixtures cover many common languages. | `src/core/indexing/symbol-detection.ts`; `tests/behavior/indexing/generic-symbol-detection.test.mjs`; `tests/behavior/retrieval/polyglot-monorepo-fallback.test.mjs`. | A beta user in a non-TS/JS repo could get exact file evidence without declaration anchors that keep excerpts focused. | Add conservative declaration anchors for Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, and shell while keeping graph gaps explicit. | Reassess package-aware caps and real MCP client trials next. | Non-TS/JS imports, tests, calls, and framework routes remain unsupported until providers and benchmarks prove them. |
| The first hosted Windows matrix run failed because fixture text files checked out with CRLF, but fixture metadata stores LF byte hashes. | GitHub Actions run `27420928678`; `.gitattributes`; `scripts/check-fixtures.mjs`; `docs/v1/fixtures/README.md`. | A beta package cannot claim cross-platform checks while Windows fails before behavior tests run. | Pin `tests/fixtures/**` to LF checkout bytes instead of changing runtime source hashing. | Watch the next hosted matrix run for the first green Windows check. | This proves fixture metadata portability only after GitHub Actions reruns on the commit that carries `.gitattributes`. |
| The next hosted Windows matrix run passed fixture checks but failed storage migration checks because SQL files checked out with CRLF while migration references store LF byte checksums. | GitHub Actions run `27422519369`; `scripts/check-storage-migrations.mjs`; `src/core/storage/migrations.ts`; `.gitattributes`. | A beta package needs cross-platform CI to prove the same migration bytes before local databases apply schema changes. | Pin `src/core/storage/migrations/*.sql` to LF checkout bytes and keep checksum enforcement over raw SQL bytes. | Watch the next hosted matrix run for the first green Windows check. | This proves migration checksum portability only after GitHub Actions reruns on the commit that carries the SQL line-ending rule. |
| The next hosted Windows matrix run passed storage checks but failed in package dry-run before reporting the npm failure because script code spawned extensionless npm and read missing stderr. | GitHub Actions run `27423019427`; `scripts/check-package.mjs`; `scripts/check-install-smoke.mjs`; `scripts/platform-command.mjs`. | A beta package gate must run on Windows and must report package failures clearly when npm or installed bins cannot launch. | Resolve npm and installed CLI commands through a small script helper and make spawn failure messages tolerate missing stderr. | Watch the next hosted matrix run for the first green Windows check. | This proves package-script portability only after GitHub Actions reruns on the command-helper change. |
| The next hosted Windows matrix run reported the npm command failure clearly, but direct `npm.cmd` spawning still failed with `EINVAL`. | GitHub Actions run `27424116581`; `scripts/platform-command.mjs`; package, install, e2e, benchmark, and MCP smoke scripts. | A beta Windows check must exercise package and installed-bin paths instead of failing before npm launches. | Use shell-backed spawn options for Windows command-script invocations while keeping POSIX spawns unchanged. | Watch the next hosted matrix run for the first green Windows check. | This proves Windows command-script portability only after GitHub Actions reruns on the shell-backed spawn change. |
| The next hosted Windows matrix run reached the packaged install smoke, but shell-wrapped `.cmd` invocation split space-containing task text and made `smoke` look like a stray CLI option. | GitHub Actions run `27424713257`; `scripts/check-install-smoke.mjs`; `scripts/e2e-alpha-smoke.mjs`; `scripts/mcp-smoke-session.mjs`; `scripts/platform-command.mjs`. | A beta Windows install check must prove normal task text with spaces, not only flag values without spaces. | Execute the installed package's declared `bin` target through Node for package smoke CLI/MCP calls while keeping shell-backed npm command-script calls. | Watch the next hosted matrix run for the first green Windows check. | This proves Windows package-entrypoint argument handling only after GitHub Actions reruns on the entrypoint change. |
| The next hosted Windows matrix run passed package and install smoke, then failed behavior tests because public path sanitization redacted active-repo Windows paths to `<local-path>` when path casing differed. | GitHub Actions run `27425951725`; `src/shared/public-output-sanitizer.ts`; `tests/behavior/cli/cli-privacy.test.mjs`; `tests/behavior/cli/cli-bootstrap-recovery.test.mjs`. | A beta Windows user needs public JSON to hide private absolute paths while still exposing repo-relative inspection paths. | Make known Windows root replacement case-insensitive and separator-agnostic before generic local path redaction. | Watch the next hosted matrix run for the first green Windows check. | This proves Windows public-output path replacement only after GitHub Actions reruns on the sanitizer change. |
| The next hosted Windows matrix run still failed behavior tests because some public outputs used the Git-reported project root while CLI redaction only knew the input root, and MCP artifact file refs kept Windows separators. | GitHub Actions run `27426952271`; `src/cli/render.ts`; `src/mcp/get-context.ts`; `tests/behavior/cli/cli-privacy.test.mjs`; `tests/behavior/contracts/beta-transport-contract.test.mjs`. | Beta users need stable public path labels and repo-relative transport paths across Windows root aliases. | Let public JSON treat returned `rootPath` as a root alias, pass app-confirmed roots to main text commands, and normalize MCP artifact file refs to forward slashes. | Watch the next hosted matrix run for the first green Windows check. | This proves Windows root-alias and transport-path handling only after GitHub Actions reruns on this fix. |
| The next hosted Windows matrix run reduced the failure set to one POSIX-only macOS temp-alias sanitizer assertion that was running on Windows. | GitHub Actions run `27428011683`; `tests/behavior/cli/cli-privacy.test.mjs`. | A beta Windows package gate must not fail because a macOS temp-path alias test assumes POSIX path resolution. | Run the macOS temp-alias assertion only on POSIX while keeping Windows root-case and separator assertions active. | Watch the next hosted matrix run for the first green Windows check. | This proves the cross-platform test gate only after GitHub Actions reruns with the gated assertion. |
| The hosted matrix now passes on Ubuntu, macOS, Windows, and the beta smoke job after the cross-platform hardening fixes. | GitHub Actions run `27428564047`; `.github/workflows/check.yml`; package, install, behavior, benchmark, and alpha e2e scripts. | The current package gate now proves the shipped CLI, MCP, storage, package, and behavior paths on hosted Windows and macOS, not only local or Linux runs. | Treat the cross-platform CI package gate as proven for the current alpha.3 hardening slice. | Resume real MCP client trials and remaining beta blockers. | GitHub Actions reported Node action deprecation and Windows image redirect notices that need CI maintenance before they become failures. |
| The green hosted matrix still used v4 GitHub actions that reported runtime deprecation warnings. | GitHub Actions run `27429136276`; `.github/workflows/check.yml`; official `actions/checkout` and `actions/setup-node` v6 READMEs. | A beta package gate can become noisy or fail when GitHub removes the older action runtime. | Move checkout and setup-node to v6 while keeping the supported package runtime at Node.js 22.13. | Watch the next hosted matrix run and confirm the action runtime warnings are gone. | GitHub's Windows image redirect notice may still appear until the hosted runner migration finishes. |
| The v6 GitHub action workflow passed on hosted CI. | GitHub Actions run `27429769909`; `.github/workflows/check.yml`. | The package gate now proves the current action runtime path across Ubuntu, macOS, Windows, and beta smoke. | Treat the Node action runtime warning as addressed for the current alpha.3 gate. | Resume real MCP client trials and remaining beta blockers. | GitHub's Windows image redirect notice may still appear until the hosted runner migration finishes. |

## Current Alpha.3 Hardening Baseline

- `grape-context@0.1.0-alpha.3` is published on npm and currently tagged as both `latest` and `alpha`.
- GitHub has `v0.1.0-alpha.3` pushed and a published GitHub release for the same version.
- Node.js 22.13 or newer is the supported global-install runtime.
- The happy path is `npm install -g grape-context@0.1.0-alpha.3`, then `grape init --connect`, then an MCP-capable agent calls `grape_get_context`.
- Manual CLI commands are debugging and fallback surfaces.
- Stable task/session identity is required for same-session omission.
- The external benchmark workspace has a scripted pass when run with the documented methodology.

## Human Review Checklist

- [x] README install/setup story names alpha.3 and Node.js 22.13+.
- [x] README explains that Grape is a controlled alpha transport slice, not a full memory platform.
- [x] Agent session contract documents stable task/session identity, reset, mismatch recovery, diff states, and MCP framing.
- [x] CLI and MCP interface docs link to the session contract.
- [x] Roadmap separates Alpha, Beta, and 1.0 expectations.
- [x] Roadmap/status docs use Done, Now, Next, Soon, and Later buckets for the real alpha.3 hardening-candidate state.
- [x] Stale alpha.1 npm-cache recovery is documented.
- [x] Task/session mismatch errors render recovery guidance that distinguishes same-task reset from new-task sessions.
- [x] Packaged install smoke selects the exact just-packed tarball, asserts installed package metadata, runs CLI help/init/two-turn compile, restores omitted CLI context, proves task/session mismatch recovery, proves reset recovery, runs MCP `initialize` and `tools/list`, performs two `grape_get_context` turns, and restores an omitted item through `grape_get_omitted_item`.
- [x] Alpha e2e smoke selects the exact just-packed tarball, uses a repo-local npm cache, asserts installed package metadata, checks two-turn omission/restore hints, and exercises installed MCP stdio setup.
- [x] Branch-switch and stale-source fixture metadata now reflects `INVALIDATE_PREVIOUS` benchmark behavior instead of no-change omission behavior.
- [x] Session reset fixture benchmark exists and proves reset emits `INVALIDATE_PREVIOUS`, sends new current context, and avoids `OMIT_UNCHANGED` on the reset turn.
- [x] Restore-path golden tests cover `RESTORE_AVAILABLE` restore ID shape, session binding, restored body shape, and MCP no-root-path output.
- [x] Dedicated task/session mismatch exit classification is approved and implemented as exit code `6`.
- [x] External benchmark workspace dependency metadata is aligned to alpha.3 after approval.
- [x] Published-package smoke passed against the registry-installed alpha.3 package in the external benchmark workspace.
- [x] Alpha.3 package metadata is aligned and `npm run check`, `npm run benchmark:run`, and `npm run e2e:alpha` are green.
- [x] `0.1.0-alpha.3` is published on npm and GitHub after release approval.
- [x] Global `npm install -g grape-context@0.1.0-alpha.3` smoke has been rerun against the published package.
- [x] External benchmark workspace published-package smoke has been rerun against registry-installed alpha.3.
- [x] Beta trial checklist exists with required client trials, pass/fail criteria, and explicit durable-workflow exclusions.

## Verified Registry And GitHub State

Checked on 2026-06-01:

```bash
npm view grape-context version dist-tags time --json
git ls-remote --tags origin
gh release view v0.1.0-alpha.3 --repo gael55x/Grape --json tagName,isDraft,isPrerelease,publishedAt,name
```

Observed:

- npm version is `0.1.0-alpha.3`.
- npm dist-tags are `latest: 0.1.0-alpha.3` and `alpha: 0.1.0-alpha.3`.
- npm publish time for `0.1.0-alpha.3` is `2026-05-31T08:17:08.988Z`.
- remote Git tag `refs/tags/v0.1.0-alpha.3` points at `802e07f0947b09a87194bae8adfc38eb53bd5091`.
- GitHub release `0.1.0-alpha.3` is published at `2026-05-31T08:24:25Z`, is not a draft, and is currently not marked as a GitHub prerelease.
- Global npm install reports `grape-context@0.1.0-alpha.3` installed, and `npm run global:smoke` passes.

## Benchmark Workspace Alignment

Inspected external benchmark workspace:

```text
<external-benchmark-workspace>
```

Observed state before alpha.3 rerun:

- `README.md` and `smoke-published.mjs` already name `grape-context@0.1.0-alpha.2`.
- `package.json`, `package-lock.json`, and installed `node_modules/grape-context` now point at alpha.2 with Node `>=22.13.0`.
- The workspace is outside this repo's writable root and is not a Git repository, so its dependency alignment is recorded here instead of committed in this repo.

Command run after approval:

```bash
cd <external-benchmark-workspace>
npm install grape-context@0.1.0-alpha.2
GRAPE_BIN="$PWD/node_modules/.bin/grape" node smoke-published.mjs
```

Alpha.3 rerun after approval:

```bash
cd <external-benchmark-workspace>
npm install grape-context@0.1.0-alpha.3 --ignore-scripts --audit=false --fund=false
GRAPE_BIN="$PWD/node_modules/.bin/grape" node smoke-published.mjs
```

The external workspace now has `package.json` dependency `^0.1.0-alpha.3`, `package-lock.json` resolves `node_modules/grape-context` to `0.1.0-alpha.3`, and the published-package smoke passed 8/8 checks for alpha.3.

Fresh beta-trial rerun on 2026-06-03:

```bash
cd <grape-repo>
npm run check
npm_config_cache=<temporary-npm-cache> npm pack --dry-run
npm run benchmark:run
npm run e2e:alpha
npm run global:smoke

cd <external-benchmark-workspace>
node run-pass.mjs
node smoke-published.mjs
graphify update <external-benchmark-workspace>/repos/ts-checkout-app
graphify query "Explain calculateDiscount behavior and discount tests" --graph <external-benchmark-workspace>/repos/ts-checkout-app/graphify-out/graph.json --budget 2000
graphify tree --graph <external-benchmark-workspace>/repos/ts-checkout-app/graphify-out/graph.json --output <external-benchmark-workspace>/repos/ts-checkout-app/graphify-out/GRAPH_TREE.html --root <external-benchmark-workspace>/repos/ts-checkout-app --label ts-checkout-app
```

Observed:

- `npm run check` passed in the latest follow-up gate, including the behavior suite, docs checks, fixture checks, package dry-run contents check, and TypeScript build checks.
- `npm pack --dry-run` passed with a temporary npm cache and confirmed `README.md`, `CHANGELOG.md`, `dist/`, package metadata, and storage migrations ship. The default local npm cache had an ownership issue, so the dry-run used a temporary npm cache path.
- `npm run benchmark:run` passed all four fixtures. The stable no-change fixture met the second-turn reduction threshold; branch-switch, stale-source, and session-reset fixtures intentionally emitted `INVALIDATE_PREVIOUS` instead of unsafe omission.
- Follow-up token-efficiency hardening added a serialized default MCP agent-output estimate and a first-turn overhead gate. The refreshed benchmark suite passed with compact `agent_pack` output while preserving the second-turn reduction threshold.
- Follow-up pipeline performance hardening reused caller-captured snapshots, guarded repeat evidence/index skips by existing rows, added scoped ledger queries and lookup indexes, and bounded lexical SQL prefiltering with normalized fallback. Artifact output now uses temp-file then rename materialization, but full post-commit file materialization remains deferred until a staged design can preserve sent-ledger correctness.
- `npm run e2e:alpha` initially failed inside restricted sandbox networking while resolving `registry.npmjs.org`; rerun with approved network access passed.
- `npm run global:smoke` passed against global `grape-context@0.1.0-alpha.3`.
- External benchmark workspace `node run-pass.mjs` passed all scripted scenarios. The same-task no-change turn preserved safe omission and restore behavior without recording raw token counts in this planning note.
- External `node smoke-published.mjs` passed 8/8 checks against the published/global CLI, including MCP `initialize`, `tools/list`, two `grape_get_context` turns, and `grape_get_omitted_item` restore.
- Graphify AST update produced a local graph for `ts-checkout-app`, and `graphify query` found the expected discount/cart/test neighborhood. Graphify's built-in `benchmark` command did not run on this small graph because its sample questions found no matching nodes, so Graphify is recorded here as a structural orientation comparison, not as an equivalent context-transport benchmark.
- The sample repo was dirty during the external trial because generated/local files were present, and Grape surfaced `dirty_worktree_context` rather than treating the context as branch-global.

Verdict:

- Ready as a **controlled beta candidate** for the V1 context-transport slice: install, local bootstrap, MCP stdio protocol, same-session omission, restore, branch/source/rules invalidation, reset recovery, package contents, and token accounting have current scripted proof.
- Not yet a defensible broad beta claim until at least one actual Cursor/Claude-style MCP client trial is recorded against the published package, plus a clean consumer repo and dirty/branch/reset recovery pass through that real client configuration.

## Verification Commands

Use these from this repository unless a command says otherwise:

```bash
npm run docs:check
npm run check
npm run benchmark:run
npm run e2e:alpha
npm run beta:check
npm run global:smoke
```

Global package smoke for a consumer repo:

```bash
npm install -g grape-context@0.1.0-alpha.3
npm run global:smoke
```

If npm resolves stale alpha.1:

```bash
npm cache clean --force
npm install -g grape-context@0.1.0-alpha.3
```

## Remaining blockers after transport-wedge cleanup

- Real MCP client trials (Cursor, Claude Code, or equivalent) against the published package are not yet recorded in-repo.
- Hosted cross-platform CI now passes for the current alpha.3 gate, including the v6 GitHub action workflow. Keep watching GitHub's Windows image redirect notice until the hosted runner migration finishes.
- Turn-1 retrieval for non-TS/JS repos now has basic declaration anchors, but still lacks language-aware graph edges, package-aware caps, and benchmark baselines.
- Benchmarks: deferred until beta architecture, schema, dirty/package, and compact output are confirmed.

The public beta transport/schema stability boundary is documented in [`docs/v1/contracts/transport-stability.md`](../contracts/transport-stability.md) and enforced through TypeScript types and `tests/behavior/contracts/beta-transport-contract.test.mjs`. A standalone output JSON Schema artifact is not required for the controlled 1.0 beta.

See [`transport-wedge-cleanup.md`](transport-wedge-cleanup.md) for the alignment summary.

## Do Not Treat As Beta Complete

- Repository artifact sections remain limited to enabled narrow claim policies and source-selection evidence.
- Grape-observed command/test runners can promote the narrow `grape_observed_run_result` proof/claim, but broader runtime truth from those runs is not implemented.
- Broader durable claim types, generated/candidate rule promotion, nested rule scope resolution, and automatic conflict resolution are explicitly excluded from the beta transport promise. Conservative parsed-rule conflict creation and manual CLI resolution are included.
- Retrieval includes deterministic TypeScript/JavaScript AST graph expansion, but embeddings, semantic ranking, complete call graphs, and broad language-aware graph support are later work.
- Polyglot and monorepo repos are safe fallback targets, not proven broad graph targets: checked-in behavior fixtures prove common-language exact/path/lexical fallback and explicit package-path scoping only. Package-aware invalidation, per-package budgets, and benchmark baselines remain planned before broad beta claims.
- Cloud sync and memory-platform features remain later work.
- Task/session mismatch recovery guidance has a dedicated exit code, but arbitrary prompt rewording still creates a distinct task/session identity in the current alpha transport contract.
- Package-lock metadata alignment, external benchmark workspace mutation, future npm publishes, version bumps, tags, releases, and dist-tags still require explicit approval.
