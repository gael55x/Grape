# Beta Readiness Checklist

## Purpose

Track the work required to move from the alpha transport proof to serious human pre-beta review.

This checklist does not expand V1 scope. It makes the current transport slice easier to install, connect, verify, and recover from.

The beta product promise is: install Grape, keep using the coding agent normally, and let Grape track seen context, send safe deltas, resend pinned safety context, invalidate stale prior sends, and restore omitted context in the background.

## Current Alpha.3 Hardening Baseline

- `grape-context@0.1.0-alpha.3` is published on npm and currently tagged as both `latest` and `alpha`.
- GitHub has `v0.1.0-alpha.3` pushed and a published GitHub release for the same version.
- Node.js 22.13 or newer is the supported global-install runtime.
- The happy path is `npm install -g grape-context@0.1.0-alpha.3`, then `grape init --connect`, then an MCP-capable agent calls `grape_get_context`.
- Manual CLI commands are debugging and fallback surfaces.
- Stable task/session identity is required for same-session omission.
- The external benchmark workspace has a 13/13 scripted pass when run with the documented methodology.

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
- [x] External benchmark workspace dependency metadata is aligned to alpha.2 after approval.
- [x] Published-package smoke passed against the registry-installed alpha.2 package in the external benchmark workspace.
- [x] Alpha.3 package metadata is aligned and `npm run check`, `npm run benchmark:run`, and `npm run e2e:alpha` are green.
- [x] `0.1.0-alpha.3` is published on npm and GitHub after release approval.
- [x] Global `npm install -g grape-context@0.1.0-alpha.3` smoke has been rerun against the published package.
- [x] External benchmark workspace published-package smoke has been rerun against registry-installed alpha.3.

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

Inspected workspace:

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
GRAPE_BIN=<external-benchmark-workspace>/node_modules/.bin/grape node smoke-published.mjs
```

Alpha.3 rerun after approval:

```bash
cd <external-benchmark-workspace>
npm install grape-context@0.1.0-alpha.3 --ignore-scripts --audit=false --fund=false
GRAPE_BIN=<external-benchmark-workspace>/node_modules/.bin/grape node smoke-published.mjs
```

The external workspace now has `package.json` dependency `^0.1.0-alpha.3`, `package-lock.json` resolves `node_modules/grape-context` to `0.1.0-alpha.3`, and the published-package smoke passed 8/8 checks for alpha.3.

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

## Do Not Treat As Beta Complete

- Scaffold-backed artifact sections are still documented limitations.
- Grape-observed command/test runs are not implemented.
- Full graph extraction, embeddings, cloud sync, and memory-platform features remain later work.
- Task/session mismatch recovery guidance has a dedicated exit code, but arbitrary prompt rewording still creates a distinct task/session identity in the current alpha transport contract.
- Package-lock metadata alignment, external benchmark workspace mutation, future npm publishes, version bumps, tags, releases, and dist-tags still require explicit approval.
