# Beta Readiness Checklist

## Purpose

Track the work required to move from the alpha.2 transport proof to serious human pre-beta review.

This checklist does not expand V1 scope. It makes the current transport slice easier to install, connect, verify, and recover from.

## Current Alpha.2 Baseline

- `grape-context@0.1.0-alpha.2` is the published alpha package for review.
- Node.js 22.13 or newer is the supported global-install runtime.
- The happy path is `npm install -g grape-context@0.1.0-alpha.2`, then `grape init --connect`, then an MCP-capable agent calls `grape_get_context`.
- Manual CLI commands are debugging and fallback surfaces.
- Stable task/session identity is required for same-session omission.
- The external benchmark workspace has a 13/13 scripted pass when run with the documented methodology.

## Human Review Checklist

- [x] README install/setup story names alpha.2 and Node.js 22.13+.
- [x] README explains that Grape is a controlled alpha transport slice, not a full memory platform.
- [x] Agent session contract documents stable task/session identity, reset, mismatch recovery, diff states, and MCP framing.
- [x] CLI and MCP interface docs link to the session contract.
- [x] Roadmap separates Alpha, Beta, and 1.0 expectations.
- [x] Roadmap/status docs use Done, Now, Next, Soon, and Later buckets for the real alpha.2 state.
- [x] Stale alpha.1 npm-cache recovery is documented.
- [x] Task/session mismatch errors render recovery guidance that distinguishes same-task reset from new-task sessions.
- [ ] Dedicated task/session mismatch exit classification is approved and implemented.
- [ ] Session reset fixture benchmark exists.
- [ ] MCP install smoke runs from the globally installed package inside this repo's gate.
- [ ] Restore-path golden tests cover the happy path in addition to stale rejection.
- [ ] External benchmark workspace dependency metadata is aligned to alpha.2 after approval.

## Benchmark Workspace Alignment

Inspected workspace:

```text
<external-benchmark-workspace>
```

Observed state:

- `README.md` and `smoke-published.mjs` already name `grape-context@0.1.0-alpha.2`.
- `package.json`, `package-lock.json`, and installed `node_modules/grape-context` still point at alpha.1.
- The workspace is outside this repo's writable root, and package-lock/package version changes require explicit approval under the alpha.2 task constraints.

Required follow-up after approval:

```bash
cd <external-benchmark-workspace>
npm install grape-context@0.1.0-alpha.2
```

Do not change benchmark methodology as part of dependency alignment.

## Verification Commands

Use these from this repository unless a command says otherwise:

```bash
npm run docs:check
npm run check
npm run benchmark:run
npm run e2e:alpha
```

Global package smoke for a consumer repo:

```bash
npm install -g grape-context@0.1.0-alpha.2
grape init --connect
grape mcp --print-config
```

If npm resolves stale alpha.1:

```bash
npm cache clean --force
npm install -g grape-context@0.1.0-alpha.2
```

## Do Not Treat As Beta Complete

- Scaffold-backed artifact sections are still documented limitations.
- Grape-observed command/test runs are not implemented.
- Full graph extraction, embeddings, cloud sync, and memory-platform features remain later work.
- Current task/session mismatch recovery guidance is improved, but the CLI still uses the storage/schema exit bucket until an exit-code change is explicitly approved.
