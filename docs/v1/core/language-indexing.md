# Language Indexing

## Purpose

Define how Grape stays language-agnostic without pretending V1 has a complete parser for every language.

Grape's transport protocol is language-agnostic. The compile layer can snapshot, hash, redact, diff, omit, restore, and invalidate context for any allowed Git-visible text file. Internally this is graph-shaped: source refs, symbols, package manifests, proofs, dependency refs, pack items, omissions, restore handles, and invalidations form connected context. Language-specific indexing is only an orientation layer that helps choose exact source spans. It is not proof, durable truth, or a complete impact graph.

## Core Rule

Retrieval and compiler code consume normalized index facts, not parser-specific facts.

Language-aware extraction must flow through provider capabilities:

```text
allowed source file -> language/provider detection -> normalized nodes, edges, diagnostics -> current-valid retrieval -> exact source excerpts
```

Provider output can guide:

- candidate source selection
- symbol anchors for excerpt windows
- import/test/config adjacency
- blind-spot warnings

Provider output must not:

- prove behavior, correctness, root cause, or fix validity
- replace exact source excerpts in high-risk tasks
- suppress pinned safety context
- cause stale context to be omitted without dependency validation
- hide unsupported-language or partial-coverage warnings

## Provider Capability Levels

Each language or framework provider should declare what it can do. Retrieval must use those capabilities instead of assuming all languages expose the same facts.

| Level | Capability | Examples | V1 handling |
|---|---|---|---|
| `lexical_path` | path, file hash, safe text search | any allowed text file | implemented fallback |
| `symbols_basic` | module/file nodes and best-effort declarations | regex or simple parser | implemented fallback for some JS-like lines |
| `symbols_ast` | high-confidence symbols and ranges | TypeScript/JavaScript AST | implemented for TS/JS |
| `module_edges` | imports, exports, package-local dependency refs | TS/JS static imports, Python imports, Java/Kotlin packages, Go packages | TS/JS only today |
| `test_edges` | test-to-source adjacency | test imports selected source | TS/JS only today |
| `framework_edges` | routes, handlers, configs, migrations | Next routes, FastAPI, Django URLs | documented future/best-effort |
| `type_aware_edges` | checker-backed declarations and call targets | TypeScript checker, Go packages | deferred |
| `runtime_edges` | observed command/test/runtime traces | Grape-observed runs | narrow observed-result claims only |

Unsupported or lower-capability providers must still emit a module/file node when safe, lexical rows when allowed, and diagnostics that describe missing graph coverage.

## Normalized Provider Output

The provider boundary should return normalized records that already match the storage/retrieval vocabulary:

- `language`
- `providerId`
- `capabilities`
- `sourceRef`
- `sourceHash`
- `nodes`
- `edges`
- `diagnostics`
- `blindSpots`

Nodes should include kind, name, path, language, line span, confidence, discovery method, and hashes when available.

Edges should include edge type, from/to refs, confidence, discovery method, and metadata needed to explain the edge. Unresolved edges are valid orientation if the unresolved target is explicit.

Diagnostics should include parser failure, unsupported extension, generated-file suspicion, unresolved import style, dynamic import/reflection, dependency injection, framework magic, workspace ambiguity, and provider capability gaps.

## Monorepo Rules

Monorepos are not just large single projects. Grape must preserve package/workspace boundaries when it decides what context to send.

The indexing layer should discover and record:

- repository root
- package/workspace roots
- manifest paths
- package manager or build system where detectable
- package-local source roots
- package-local test roots
- package-local dependency manifests and lockfiles
- cross-package edges when a provider can justify them
- capability gaps per package or language

Retrieval should:

- prioritize explicit seed refs inside their package/workspace when possible
- cap selected context per package/language before applying a global cap
- include package manifests that explain selected package context
- avoid letting a large unrelated package exhaust the source budget
- emit `partial_with_risk` warnings when workspace/package boundaries are unknown

Invalidation should:

- invalidate context tied to the package manifest or lockfile that changed
- avoid invalidating unrelated packages when dependency refs are package-scoped
- still fail closed when a changed root manifest can affect multiple packages

## Current V1 Reality

Current implementation is useful but not broad language-aware indexing:

- TypeScript/JavaScript files get deterministic AST-backed symbols, imports, exports, direct calls, and related-test orientation.
- JSON and Markdown are classified as known languages for indexing and lexical search, but they do not have AST graph extraction.
- Python, Java, Kotlin, Go, Rust, YAML, and other languages mostly fall back to file path/text indexing today.
- Bootstrap detection can report Python, Go, Rust, package managers, and common frameworks from root manifests, but those are setup hints only.
- Current provider diagnostics are not a first-class storage family.
- Current selection caps are global, not package-aware.
- Current checked-in benchmark fixtures are TypeScript-focused; monorepo and polyglot fixture coverage is still pending.

This is acceptable for a controlled beta only if the promise stays: reliable context transport with safe fallback retrieval, not universal code intelligence.

## Known Failure Modes And Bad Assumptions

- Direct parser coupling: `src/core/indexing/file-index.ts` calls the TS/JS parser directly instead of dispatching through providers.
- JS-style import bias: local import resolution checks JS/TS extensions and `index.*` forms only.
- Regex fallback bias: generic symbol detection recognizes JS/TS-like declarations, not Python, Java, Kotlin, Go, Rust, C#, Ruby, or PHP declarations.
- Language detection gaps: unknown extensions collapse to `unknown`, and YAML/Python/Java/Kotlin/Go/Rust are not first-class in `languageForPath` yet.
- Monorepo flattening: repository snapshot and retrieval currently treat the repo as one source pool, so large unrelated packages can starve a task-specific package.
- Root-manifest bias: bootstrap detection mostly checks root-level manifests/configs and can miss nested workspaces.
- Test adjacency bias: related-test selection depends on import/call edges that exist today primarily for TS/JS.
- Capability opacity: agents see blind spots, but not a complete provider capability report per language/package.
- Fixture drift: docs list monorepo and dynamic-import fixtures, but checked-in fixture coverage is still narrower.

## Beta Readiness Standard

Before Grape claims broad polyglot or monorepo retrieval, it needs:

- a provider dispatcher with a stable normalized output contract
- capability metadata surfaced in artifacts or diagnostics
- package/workspace boundary detection
- per-package/per-language retrieval caps
- at least one checked-in polyglot fixture
- at least one checked-in monorepo fixture
- tests that prove unsupported languages still produce safe lexical/path context and explicit warnings
- tests that prove package-local manifest changes do not over-invalidate unrelated package context when dependency refs are scoped

This is a beta hardening path, not a request to build a universal parser in V1.
