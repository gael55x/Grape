# Language Indexing

## Purpose

Define how Grape stays language-agnostic without pretending V1 has a complete parser for every language.

Grape's transport protocol is language-agnostic. The compile layer can snapshot, hash, redact, diff, omit, restore, and invalidate context for any allowed Git-visible text file. Internally this is graph-shaped: source refs, symbols, package manifests, proofs, dependency refs, pack items, omissions, restore handles, and invalidations form connected context. Language-specific indexing is primarily an orientation layer that helps choose exact source spans. Provider output is not proof, durable truth, or a complete impact graph unless a separate Trust Kernel policy promotes a narrow provider-backed claim with exact source hashes and current-valid scope.

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

The current source-level contract is `LanguageProviderMetadata`. File indexing stamps provider identity, declared capabilities, capability-gap diagnostics, and blind-spot codes into existing `symbol_nodes` and `symbol_edges` metadata. This metadata is evidence provenance and orientation only; it is not proof and it does not create durable claims.

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
- Every indexed file is tagged with normalized provider metadata. TypeScript/JavaScript AST rows use the `typescript_ast` provider. Safe fallback rows use the `generic_text` provider with explicit `module_edges` and `test_edges` capability-gap diagnostics.
- Generic manifest detection tags package-root evidence for common manifests such as `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, and Gradle build/settings files. Nested source files under those roots carry the manifest ref and manifest kind as index metadata.
- High-confidence TypeScript/JavaScript AST declaration nodes can promote the narrow `repository_symbol_declaration_exists` claim only when covered by an accepted exact source excerpt window and `provider_symbol_declaration` proof; this proves declaration-span existence only.
- Supported npm `package.json` dependency entries can promote the narrow `package_manifest_dependency_exists` claim only when the allowed manifest source hash matches, the exact dependency entry is hashed as a direct `package_manifest_dependency_entry` proof, and current-valid scope matches. This proves only that the manifest declares the dependency entry; it does not prove installation, import usage, runtime requirement, safety, validity, lockfile resolution, or package-aware invalidation.
- JSON and Markdown are classified as known languages for indexing and lexical search, but they do not have AST graph extraction.
- Python, Java, Kotlin, Go, Rust, YAML, and other languages mostly fall back to file path/text indexing today.
- Bootstrap detection can report Python, Go, Rust, package managers, and common frameworks from root manifests, but those are setup hints only.
- Current provider diagnostics live in index metadata, not a first-class storage family.
- Current selection caps are mostly global. If a task names an exact source path inside `packages/<name>/`, `apps/<name>/`, `services/<name>/`, or `libs/<name>/`, broad symbol and lexical expansion is scoped to that workspace path before the global cap is applied. Current-valid claim filtering uses that same common-prefix root only when explicit source refs identify exactly one package root; claim scopes record the common-prefix package root from their own exact source refs. Manifest-derived package roots are index evidence today, not a complete package-aware retrieval or invalidation policy.
- `tests/fixtures/polyglot-fallback-repo` proves Python, Java, and Kotlin files can be selected as exact lexical/path evidence with partial-context warnings. It does not prove language-aware import, call, or test edges for those languages.
- `tests/fixtures/monorepo-lite-repo` proves an explicit `packages/api/...` task can select package-local TS source plus related tests without pulling an unrelated `packages/web/...` source. It does not prove package-aware invalidation, nested manifest dependency scoping, or per-package budgets.
- Current checked-in benchmark fixtures remain TypeScript-focused; the polyglot and monorepo fixtures are behavior proof fixtures, not token benchmark baselines.

This is acceptable for a controlled beta only if the promise stays: reliable context transport with safe fallback retrieval, not universal code intelligence.

## Known Failure Modes And Bad Assumptions

- Shallow provider dispatch: `src/core/indexing/file-index.ts` chooses between the TS/JS parser and generic text fallback, but broad provider modules under `src/core/indexing/languages/` are still pending.
- JS-style import bias: local import resolution checks JS/TS extensions and `index.*` forms only.
- Regex fallback bias: generic symbol detection recognizes JS/TS-like declarations, not Python, Java, Kotlin, Go, Rust, C#, Ruby, or PHP declarations.
- Language detection gaps: unknown extensions still collapse to `unknown`, and language labels do not imply graph extraction capability.
- Monorepo flattening: repository snapshot and retrieval mostly treat the repo as one source pool. Explicit package-path tasks and package-scoped claim activation use common-prefix scope metadata, and package manifests now produce package-root index metadata, but package-aware invalidation and per-package budgets are not implemented yet.
- Manifest dependency narrowness: durable manifest dependency claims are currently npm `package.json` declaration facts only. Other manifest formats, dependency closure, lockfile resolution, and import-derived dependency claims remain disabled.
- Root-manifest bias: bootstrap detection mostly checks root-level manifests/configs and can miss nested workspaces.
- Test adjacency bias: related-test selection depends on import/call edges that exist today primarily for TS/JS.
- Capability opacity: agents see blind spots, but not a complete provider capability report per language/package.
- Fixture drift: checked-in polyglot and monorepo fixtures now cover safe fallback and explicit path scoping only. Dynamic imports, package-aware invalidation, and full polyglot graph fixtures are still narrower than the long-term matrix.

## Beta Readiness Standard

Before Grape claims broad polyglot or monorepo retrieval, it needs:

- a provider dispatcher with a stable normalized output contract
- capability metadata surfaced in artifacts or diagnostics
- package/workspace boundary metadata consumed by retrieval, current-valid scope, and invalidation policy
- per-package/per-language retrieval caps beyond the current explicit-path guard
- checked-in polyglot fixture coverage for safe lexical/path fallback
- checked-in monorepo fixture coverage for explicit package-path scoping
- tests that prove unsupported languages still produce safe lexical/path context and explicit warnings
- tests that prove package-local manifest changes do not over-invalidate unrelated package context when dependency refs are scoped

This is a beta hardening path, not a request to build a universal parser in V1.
