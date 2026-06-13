# Language Indexing

## Purpose

Define how Grape stays language-agnostic without pretending V1 has a complete parser for every language.

Grape's transport protocol is language-agnostic. The compile layer can snapshot, hash, redact, diff, omit, restore, and invalidate context for any allowed Git-visible text file. Internally this is graph-shaped: source refs, symbols, package manifests, proofs, dependency refs, pack items, omissions, restore handles, and invalidations form connected context. Language-specific indexing is primarily an orientation layer that helps choose exact source spans.

**Alpha.3 indexing strength:** TypeScript/JavaScript AST extraction is the strongest current signal (`symbols_ast`, `module_edges`, `test_edges`). Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, and shell use safe fallback with lexical search and conservative declaration anchors. JSON, YAML, TOML, and other config files use path and lexical fallback when the indexer reads them. Explicit Markdown paths can be selected as exact source evidence, while rule Markdown follows the project-rule path. Safe fallback means exact source evidence and path selection for any allowed Git-visible text file, plus lexical search and basic symbol anchors where the regex detector has a conservative language pattern. Grape must not claim full polyglot graph extraction from fallback paths.

Provider output is not proof, durable truth, or a complete impact graph unless a separate Trust Kernel policy promotes a narrow provider-backed claim with exact source hashes and current-valid scope.

## Core Rule

Retrieval and compiler code consume normalized index facts, not parser-specific facts.

Language-aware extraction must flow through provider capabilities:

```text
allowed source file, language/provider detection, normalized nodes, edges, diagnostics, current-valid retrieval, exact source excerpts
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
| `symbols_basic` | module/file nodes and best-effort declarations | regex or simple parser | implemented fallback for common declaration lines in Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, shell, and JS-like syntax |
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
- Conservative generic symbol detection now anchors common declaration lines in Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, and shell files. These anchors help exact source excerpts start near named declarations. They do not create import edges, test edges, call graphs, or durable symbol-declaration claims.
- Import-looking text in generic fallback files stays lexical and symbol context only. Grape does not emit module edges from fallback regex matches unless a provider declares `module_edges` support.
- JSON, YAML, TOML, and common config files are indexed as known generic text, but they do not have AST graph extraction or structured config graph extraction.
- Markdown files are labelled as known by path and can be selected as exact source evidence. Ordinary docs are not part of lexical or symbol indexing today unless they are rule files.
- Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, and shell mostly fall back to file path, lexical text, and conservative declaration anchors today. JSON, YAML, TOML, and other config files fall back to path and text indexing.
- Bootstrap detection can report Python, Go, Rust, package managers, and common frameworks from root manifests, but those are setup hints only.
- Current provider diagnostics live in index metadata, not a first-class storage family. The `index-blind-spots` artifact section summarizes selected source languages, selected package roots when known, provider IDs, provider capabilities, and provider capability gaps from selected symbol metadata. It also renders a compact indexed provider summary across module nodes in the current snapshot, grouped by language and provider with file counts, capabilities, and gaps.
- Current selection caps are mostly global. If a task names exact source refs outside a recognized workspace path or indexed package root, broad lexical expansion stays on those refs. If exact refs identify one common workspace path under `packages/<name>/`, `apps/<name>/`, `services/<name>/`, or `libs/<name>/`, or selected refs carry manifest-derived package-root metadata, symbol and lexical expansion can stay inside that package before the global cap is applied. Direct graph relationships and explicit seed symbol or test-name matches can still add sources. Within a ranked tier, selected refs can spread across known package roots and across indexed source languages before the global cap applies. Current-valid claim filtering can use one common-prefix root or one manifest-backed package root when explicit source refs identify exactly one package root. Claim scopes record common-prefix package roots, source/symbol metadata package roots, or supported npm manifest package roots from their exact proof sources. Manifest-derived package roots can guide selected source retrieval, current-valid package scope, and package-local manifest and lockfile dependency refs for selected package context, but they are not a complete package-aware retrieval policy.
- `tests/fixtures/polyglot-fallback-repo` proves Python, Java, Kotlin, Go, Rust, C#, Ruby, PHP, Swift, C, C++, shell, JSON, YAML, TOML, and explicit Markdown paths can be selected as exact fallback evidence with partial-context warnings. It also proves conservative declaration anchors for common source languages through `tests/behavior/indexing/generic-symbol-detection.test.mjs` and artifact-level anchors through `tests/behavior/retrieval/polyglot-monorepo-fallback.test.mjs`. It does not prove language-aware import, call, or test edges for those languages or file types.
- `tests/fixtures/monorepo-lite-repo` proves an explicit `packages/api/...` task can select package-local TS source plus related tests without pulling an unrelated `packages/web/...` source. Retrieval tests cover nested manifest-derived package scoping outside common workspace prefixes. Package-local manifest and lockfile dependency refs are covered by compiler and transport tests for explicit package-root context, and compiler tests also cover nested manifest-derived package context outside common workspace prefixes. The fixture still does not prove full workspace dependency closure or per-package budgets.
- Current checked-in benchmark fixtures remain TypeScript-focused; the polyglot and monorepo fixtures are behavior proof fixtures, not token benchmark baselines.

This is acceptable for a controlled beta only if the promise stays: reliable context transport with safe fallback retrieval, not universal code intelligence.

## Known Failure Modes And Bad Assumptions

- Shallow provider dispatch: `src/core/indexing/file-index-provider.ts` chooses between the TS/JS parser and generic text fallback. Grape does not yet have a per-language provider module tree.
- JS-style import bias: local import resolution checks JS/TS extensions and `index.*` forms only.
- Regex fallback is declaration-only: generic symbol detection recognizes conservative common declaration lines, but it can miss decorators, annotations, macros, overloads, generated code, nested declarations, language-specific type aliases, and framework entry points.
- Language detection gaps: unknown extensions still collapse to `unknown`, and language labels do not imply graph extraction capability.
- Monorepo flattening: repository snapshot and retrieval mostly treat the repo as one source pool. Explicit package-path tasks and package-scoped claim activation can use common-prefix scope metadata or manifest-backed package-root metadata from exact refs. Package manifests produce package-root index metadata, selected source retrieval can use manifest-derived package roots, and selected package context carries package-local manifest and lockfile dependency refs for common-prefix and manifest-derived package roots. Ranked tiers can spread across known package roots and indexed source languages before the global cap applies. Full package-aware budgets, dependency closure, and workspace graph policy are not implemented yet.
- Manifest dependency narrowness: durable manifest dependency claims are currently npm `package.json` declaration facts only. Other manifest formats, dependency closure, lockfile resolution, and import-derived dependency claims remain disabled.
- Root-manifest bias: bootstrap detection mostly checks root-level manifests/configs and can miss nested workspaces.
- Test adjacency bias: related-test selection depends on import/call edges that exist today primarily for TS/JS.
- Capability opacity: agents see selected provider capability gaps, selected package provider gaps when package-root metadata is available, and a repo-level indexed provider summary by language/provider. They do not see a complete provider capability report for every package.
- Fixture drift: checked-in polyglot and monorepo fixtures now cover safe fallback, explicit path scoping, manifest-derived nested package scoping, and selected package manifest dependency refs only. Dynamic imports, full workspace graph policy, and full polyglot graph fixtures are still narrower than the long-term matrix.

## Beta Readiness Standard

Before Grape claims broad polyglot or monorepo retrieval, it needs:

- per-language provider modules that emit the normalized index output
- complete per-package capability metadata surfaced in artifacts or diagnostics
- package/workspace boundary metadata consumed by retrieval, current-valid scope, and invalidation policy
- per-package/per-language retrieval caps beyond the current explicit-path guard and in-tier package/language spreading
- benchmark baselines for polyglot and monorepo scenarios, not only behavior fixtures
- tests that prove package-local manifest changes do not over-invalidate unrelated package context when dependency refs are scoped

This is a beta hardening path, not a request to build a universal parser in V1.
