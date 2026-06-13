<p align="center">
  <img src="docs/assets/grape-nw.png" alt="Grape logo" width="128" />
</p>

<h1 align="center">Grape</h1>

<p align="center">
   Better context transport for AI coding agents.
</p>

<p align="center">
  <a href="docs/README.md"><strong>Documentation</strong></a>
  ·
  <a href="docs/v1/architecture/overview.md"><strong>Architecture</strong></a>
  ·
  <a href="ROADMAP.md"><strong>Roadmap</strong></a>
  ·
  <a href="CONTRIBUTING.md"><strong>Contributing</strong></a>
</p>

<p align="center">
  <img alt="Local-first" src="https://img.shields.io/badge/local--first-repository%20native-176f45" />
  <img alt="Artifact-first" src="https://img.shields.io/badge/artifact--first-context%20packs-6f42c1" />
  <img alt="CLI and MCP" src="https://img.shields.io/badge/interfaces-CLI%20%2B%20MCP-044a64" />
  <img alt="Dependency-tracked" src="https://img.shields.io/badge/tracking-dependency%20hashes-111827" />
</p>



**Stop making agents rediscover your codebase.** 

AI coding agents are powerful, but they waste context.

They reread the same files.
They rediscover the same project rules.
They forget what changed between turns.
They keep stale assumptions after branch switches and file edits.
They burn tool calls rebuilding context they already had.

Grape gives coding agents a local context layer for real repositories.

It compiles the useful parts of your repo into dependency-tracked context artifacts, remembers what a specific agent session has already seen, and sends only what is new, changed, pinned, restorable, or stale.

The result is cleaner agent context, safer omission, and fewer repeated “let me inspect the repo again” loops.

## What Grape does

Grape sits between your repository and your AI coding agent.

It helps the agent answer three questions every turn:

1. **What context does this task need?**
2. **What context has this session already received?**
3. **What previous context is now stale because the repo changed?**

Instead of shipping a fresh wall of files every time, Grape returns a structured context pack:

| Item                  | Meaning                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `NEW`                 | Context the current session has not seen yet.                         |
| `CHANGED`             | Context that changed since the session last saw it.                   |
| `PINNED`              | Safety-critical context that must be resent.                          |
| `OMIT_UNCHANGED`      | Context safely omitted because this same session already received it. |
| `RESTORE_AVAILABLE`   | Omitted context that can be fetched back if needed.                   |
| `INVALIDATE_PREVIOUS` | Prior context that should no longer be trusted.                       |

Grape is not trying to replace your coding agent. It makes your existing agent better at carrying repository context across turns.

## Install

Requirements:

* Node.js 22.13 or newer
* npm
* Git

Install Grape:

```bash
npm install -g grape-context
```

Initialize it inside a repository:

```bash
grape init --connect
```

This creates local Grape state, captures the initial repository snapshot, and prints MCP setup guidance for your coding agent.

Check local privacy settings:

```bash
grape doctor --privacy
```

## Use it with an agent

Grape works best through MCP.

After setup, your MCP-capable coding agent calls:

```text
grape_get_context
```

The agent can then request task-specific repository context without manually rebuilding the same prompt every turn.

A typical loop looks like this:

```text
User asks coding agent to fix a task
Agent calls grape_get_context
Grape returns relevant repo context
Agent edits code
Repo changes
Agent calls grape_get_context again
Grape sends only the useful delta and invalidates stale context
```

Manual CLI usage is available for debugging:

```bash
grape compile --task "Explain the files I need to edit"
grape status
grape sessions
grape artifacts
grape omitted --session <id>
grape stale
grape conflicts
```

See the full [CLI reference](docs/v1/interfaces/cli.md) and [MCP tools](docs/v1/interfaces/mcp-tools.md).

## Why this matters

Most agent workflows still treat context as disposable text.

That breaks down on larger tasks because the agent needs more than search results. It needs to know:

* which files matter
* which rules apply
* which context it already saw
* which context changed
* which assumptions are stale
* which omitted context can be restored
* which safety constraints must be repeated
* which evidence supports a claim

Grape treats context like a build artifact.

It is compiled from repository state, linked to dependencies, scoped to a session, and invalidated when its inputs change.

## Local-first by design

Grape runs against your local repository.

By default, it does not send repository content, artifacts, proofs, summaries, embeddings, or telemetry to a remote Grape service.

Local runtime state lives under `.grape/`. Grape keeps this state out of Git through `.git/info/exclude`.

Grape also:

* respects Git ignores and local privacy ignores
* excludes `.grape/` runtime state from snapshots
* blocks common raw secret shapes before artifact output
* avoids exposing raw secret values in diagnostics
* separates raw evidence from assistant-written summaries
* prevents summaries from becoming durable proof

Repository content is still untrusted input. Source files, comments, docs, tests, and fixtures can contain prompt-injection text or private implementation details. Review context before forwarding it to an LLM, and keep real secrets in ignored files.

## How Grape works

Grape has three core stages.

### 1. Compile

Grape reads the working tree, branch state, source excerpts, project rules, manifests, observed command results, and narrow proof-backed claims.

It builds a `ContextArtifact` for the current task.

### 2. Track

Each artifact records the files, rules, proofs, config, branch state, manifests, and dependency hashes that shaped it.

When those inputs change, Grape can detect stale context instead of silently reusing it.

### 3. Diff

Grape compares the latest artifact with what the same agent session already received.

It then returns a `ContextPack` containing only the useful delta.

```mermaid
flowchart LR
  Agent[AI coding agent] --> MCP[MCP or CLI]
  MCP --> Compile[Compile context]
  Compile --> Artifact[Context artifact]
  Artifact --> Diff[Session diff]
  Diff --> Pack[Context pack]
  Pack --> Agent
  Repo[Git working tree] --> Compile
  State[(Local SQLite state)] --> Compile
  State --> Diff
```

## Core guarantees

Grape is built around strict context rules:

* **Repository state is the source of truth.** Context comes from the working tree, branch state, rules, evidence, and local session ledger.
* **Diffs are session-scoped.** One session cannot omit context just because another session saw it.
* **Pinned context is resent.** Safety-critical rules and constraints are not optimized away.
* **Stale context is invalidated.** Branch, file, rule, config, manifest, and proof changes can invalidate prior context.
* **Proof is not summary.** Assistant-written summaries cannot promote themselves into durable truth.
* **Compression is cache, not truth.** Summaries may reduce repeated transport cost, but they do not prove behavior.
* **Current context beats merely relevant context.** Stale, private, branch-invalid, dirty-scope, or contradicted context is filtered before ranking.

## What Grape is not

Grape is not:

* a chatbot
* a coding assistant
* a vector database
* a cloud memory platform
* a correctness prover
* a full repo graph daemon
* a replacement for tests or review

Grape does not prove that an agent’s answer is correct. It gives the agent better repository context to work with.

## Language support

Grape currently has its strongest graph signal for TypeScript and JavaScript.

For other languages and text formats, Grape uses safe fallback behavior unless stronger support is proven through fixtures.

Fallback coverage includes:

* Python
* Java
* Kotlin
* Go
* Rust
* C#
* Ruby
* PHP
* Swift
* C
* C++
* shell
* JSON
* YAML
* TOML
* Markdown

Fallback does not mean ignored. It means Grape avoids pretending it has precise graph knowledge when it only has exact source, paths, lexical matches, or explicit references.

## Benchmark evidence

Grape includes benchmark fixtures and scripts for local comparison. Recorded numbers are fixture evidence only. They are not production performance proof or claims that Grape beats naive context, search, or external tools unless a committed result file, command, date, and limits are named together.

### Transport fixtures

`npm run bench` exercises the installed package on six named fixtures. On the three no-change transport fixtures, the second same-session turn reduced body-token context with zero unsafe omissions and zero stale sends:

| Fixture | Turn 1 body tokens | Turn 2 body tokens | Reduction |
| --- | ---: | ---: | ---: |
| `clean-typescript-app` | 2811 | 1663 | 50.4% |
| `polyglot-fallback-repo` | 3132 | 2523 | 31.46% |
| `monorepo-lite-repo` | 3388 | 1885 | 52.07% |

The same run also passed branch-switch, stale-source, and session-reset invalidation fixtures.

That supports the core beta transport claim on these fixtures: Grape can omit unchanged same-session context, keep restore metadata for omitted items, and invalidate prior context when files, branches, or sessions change.

### Published-package baselines

`npm run bench:post-beta` compares the published npm package with naive and search baselines on three small tasks. Results report file-level recall, known-noise ratio, layered output metrics, and rough serialized output size.

Post-beta baselines help answer whether Grape finds the right files and where known-irrelevant paths enter the compiled output. They do not prove token-size savings against naive or search, production readiness, or superiority over external tools.

See [Benchmarks](docs/v1/quality/benchmarks.md) for commands, fixture names, result files, and caveats.

## Project status

Grape is currently in 1.0 beta.

The beta focuses on local context transport, session-aware diffs, restore behavior, stale context invalidation, proof separation, and MCP integration.

Implemented today:

* global npm install through `grape-context`
* `grape init --connect`
* local SQLite runtime state
* CLI and MCP context retrieval
* session-aware context packs
* omitted context restore
* branch, source, and session invalidation
* dependency-tracked context artifacts
* exact source and rule proof rows
* narrow current-valid claims
* TypeScript and JavaScript indexing for common imports, exports, symbols, calls, and related test hints
* safe fallback for supported text files
* observed command and test evidence through `grape run` and `grape test`
* local check suite, benchmark fixtures, package smoke, and packaged MCP smoke

Not promised yet:

* production stability
* cloud sync
* broad agent memory
* full semantic ranking
* embeddings
* complete call graphs
* broad language-aware graph extraction
* automatic conflict resolution
* broad durable claim promotion
* benchmark superiority claims
* guaranteed behavior in every IDE MCP client without a human client trial

APIs, schemas, command names, setup guidance, and internal contracts may still change before stable 1.0.

## Development

Install dependencies:

```bash
npm ci
```

Run the local gate:

```bash
npm run check
```

Run the extended beta-readiness gate:

```bash
npm run beta:check
```

`npm run check` covers documentation structure, fixtures, in-memory context loop checks, architecture boundaries, storage migrations, TypeScript typechecking, package dry-run contents, and behavior tests.

`npm run beta:check` runs the local check suite, benchmark fixtures, and packaged MCP smoke. The packaged MCP smoke validates stdio MCP behavior from an installed package. It is not a replacement for a human Cursor or Claude Code UI trial when release policy requires one.

After installing the published package globally, run:

```bash
npm run global:smoke
```

## Documentation

Start here:

* [Documentation index](docs/README.md)
* [V1 documentation](docs/v1/README.md)
* [Implementation contract](docs/v1/SPEC.md)
* [Architecture overview](docs/v1/architecture/overview.md)
* [State machine](docs/v1/architecture/state-machine.md)
* [Invariants](docs/v1/architecture/invariants.md)
* [Roadmap](ROADMAP.md)
* [Contributing](CONTRIBUTING.md)

Core references:

* [Trust model](docs/v1/core/trust-model.md)
* [Context artifact](docs/v1/contracts/context-artifact.md)
* [Context diff](docs/v1/contracts/context-diff.md)
* [Agent sessions](docs/v1/interfaces/agent-sessions.md)
* [Compression](docs/v1/core/compression.md)
* [Storage](docs/v1/core/storage.md)
* [Security](docs/v1/core/security.md)
* [MCP tools](docs/v1/interfaces/mcp-tools.md)
* [CLI](docs/v1/interfaces/cli.md)
* [Testing](docs/v1/quality/testing.md)
* [Benchmarks](docs/v1/quality/benchmarks.md)

## Contributing

Grape is not ready for broad feature expansion yet.

Contributions should preserve the implementation contract and avoid expanding the product surface before the current roadmap goal is proven.

Before contributing, read:

* [Contributing guide](CONTRIBUTING.md)
* [Invariants](docs/v1/architecture/invariants.md)
* [Roadmap](ROADMAP.md)

Implementation standards:

* no godfiles
* no generic utility dumps
* no hidden state transitions
* no direct SQLite access outside storage repositories
* no summaries as proof
* no MCP writes that promote durable truth
* no stale dependency manifests in returned context


## Star History
<p align="center">

  <a href="https://www.star-history.com/?repos=gael55x%2FGrape&type=date&legend=top-left">
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=gael55x/Grape&type=date&theme=dark&legend=top-left" />
     <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=gael55x/Grape&type=date&legend=top-left" />
     <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=gael55x/Grape&type=date&legend=top-left" />
   </picture>
  </a>
</p>

## License

[MIT](LICENSE)
