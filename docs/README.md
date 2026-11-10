# Grape Documentation

Grape is session-aware repository context for AI coding agents. It is published on npm as [`grape-context`](https://www.npmjs.com/package/grape-context). This page is the entry point to every committed document.

## Start here

| If you want to | Read |
| --- | --- |
| Install Grape and connect a coding agent | [Getting started](v1/interfaces/getting-started.md) |
| Understand what Grape does and why | [Project README](../README.md) |
| See what changed in each release | [Changelog](../CHANGELOG.md) |

## Using Grape

| Document | Covers |
| --- | --- |
| [Getting started](v1/interfaces/getting-started.md) | Requirements, install, client setup, the agent loop, and common errors. |
| [Agent sessions](v1/interfaces/agent-sessions.md) | Session identity, follow-up turns, resets, and recovery. |
| [MCP tools](v1/interfaces/mcp-tools.md) | Every MCP tool, its inputs, outputs, and safety rules. |
| [CLI reference](v1/interfaces/cli.md) | Every command, flag, and exit code. |

## Integrating with an agent or client

| Document | Covers |
| --- | --- |
| [Context diff protocol](v1/contracts/context-diff.md) | The six diff states and the rules for omission, restore, and invalidation. |
| [Transport stability](v1/contracts/transport-stability.md) | Which response fields are stable, experimental, or inspection-only. |
| [Context artifact](v1/contracts/context-artifact.md) | The stored artifact format behind each response. |

## How Grape works

| Document | Covers |
| --- | --- |
| [Architecture overview](v1/architecture/overview.md) | Components and data flow. |
| [Invariants](v1/architecture/invariants.md) | The guarantees every change must preserve. |
| [Trust model](v1/core/trust-model.md) | How evidence, proofs, and summaries are kept separate. |
| [Security](v1/core/security.md) and [Storage](v1/core/storage.md) | Secret handling, privacy, and local state. |
| [Retrieval](v1/core/retrieval.md) and [Language indexing](v1/core/language-indexing.md) | How context is selected and which languages have full support. |

## Contributing

| Document | Covers |
| --- | --- |
| [Contributing guide](../CONTRIBUTING.md) | How to propose and test a change. |
| [V1 specification](v1/SPEC.md) | The canonical implementation contract. |
| [Testing](v1/quality/testing.md) and [Benchmarks](v1/quality/benchmarks.md) | Local gates, fixtures, and what the benchmarks do and do not show. |
| [Decision records](v1/decisions/README.md) | Why the main design choices were made. |

## Source of truth

- [`v1/SPEC.md`](v1/SPEC.md) is the canonical implementation contract. If another document conflicts with it, the specification wins, and the conflict should be fixed before code changes.
- Supporting documents are grouped by purpose under `docs/v1/`.
- [V2 planning](v2/README.md) is future work only. [Alpha-era documents](v1/legacy/alpha/README.md) are kept for history, and the [archive](archive/README.md) points to them.
- `do-not-commit-docs/` holds private planning material and must not be committed.
