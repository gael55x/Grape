# Retrieval

V1 retrieval is intentionally conservative. It selects current repository context from allowed, hash-verified local sources and exposes blind spots rather than claiming complete code-intelligence coverage.

See [`language-indexing.md`](language-indexing.md) for the provider capability model that keeps retrieval language-agnostic while allowing language-specific extractors.

## Beta Retrieval V2 Contract

Beta Retrieval V2 upgrades the current lightweight selector into a deterministic retrieval planner over normalized provider output. It may use language-aware graph facts to expand task context where a provider declares support, but exact source excerpts, rule text, proof rows, dependency manifests, and current-valid claim filtering remain the authority.

The beta planner may include:

- explicit file, symbol, and test seeds
- safe lexical matches from allowed current-snapshot sources
- provider-backed module, export, import, symbol, method, call, config, and test/source relationship edges when supported
- current-valid source-excerpt claims
- current-valid observed-run result claims
- current-valid parsed `project_rule` claims from rule-file excerpts
- deterministic conflict/supersession filters for conflict edges and manual resolution edges

The beta planner must not:

- treat graph expansion as proof
- include ignored/private/secret-looking source bodies
- promote behavior, correctness, root-cause, or fix-result claims from observed command/test runs
- use model summaries or compression artifacts as proof
- claim complete semantic search, embeddings, or full multi-language graph coverage
- treat unsupported-language fallback as successful language-aware graph extraction
- flatten monorepo package/workspace boundaries when dependency refs can be scoped

Retrieval may rank only current-valid claims whose claim type is enabled by the
Trust Kernel durable claim policy registry. Semantic candidates, graph expansion,
compression artifacts, and summaries may help order or route context, but they
cannot create durable claims, satisfy proof requirements, or override
current-valid rejection.

## Current Inputs

The current retrieval path may use:

- explicit file, symbol, and test seeds from CLI/MCP requests
- Git-visible source records from the current snapshot
- safe portable lexical search rows built from allowed source records
- AST-backed TypeScript/JavaScript symbol nodes for modules, functions, classes, methods, interfaces, types, constants, and variables
- local import/export/call relationships discovered from AST traversal where supported
- file-level module nodes and lexical rows for unsupported languages where source text is safe to index
- current-valid narrow source-excerpt claims after proof validation
- current-valid narrow observed-run result claims after trusted local `grape run` / `grape test` promotion

Private, ignored, unreadable, oversized, binary, stale-hash, and secret-looking files are not valid retrieval inputs.

## Selection Rules

Task source retrieval is an impact candidate selector, not relevance ranking over durable truth.

- Explicit seed files are selected first when they exist in the current snapshot.
- Source file paths mentioned directly in the task are treated as explicit source anchors when they match current snapshot files.
- When an explicit task or seed path is inside a common workspace directory such as `packages/<name>/`, broad symbol and lexical expansion is scoped to that package before global caps are applied.
- Path-like test seeds may select matching test files as exact source context.
- Symbol matches may select source files and line anchors for exact excerpt windows.
- Graph expansion may select directly related source files through supported import and call edges.
- Related tests may be selected when a test imports or calls a selected source file.
- Lexical matches may add source refs from safe indexed text.
- Lexical repository search should use storage-bounded prefiltering where possible, but the deterministic normalized matcher remains the final authority so punctuation/case normalization behavior does not change.
- In monorepos, explicit seed refs should be interpreted inside their package/workspace when known, and source budgets should avoid allowing unrelated packages or languages to exhaust the selected context.
- Package-local manifests and lockfiles should be dependency refs for selected package context when the package/workspace root is known.
- Current-valid `grape_observed_run_result` claims from the current compile session may be rendered with task-scoped claims. Compile sessions are task-bound, and current-valid checks still require matching branch, commit, worktree hash, source hash, and result hash.
- Current-valid parsed `project_rule` claims may render with task-scoped claims, while exact rule text remains pinned in the active-project-rules section.
- Current-valid filtering rejects claims blocked by active claim edges after shared scope compatibility is resolved. Unresolved `contradicts` edges block both claims when scopes overlap or overlap is unknown; disjoint scopes do not deactivate either claim. Unresolved `violates` edges block the violating source claim when scopes overlap or overlap is unknown. Compatible `supersedes` edges block the superseded target claim until an applicable manual resolution edge says the claims may coexist or are variants. A `supersedes` edge is compatible only when the linked claims have matching claim type, resolved subject, exact source ref, and compatible branch/commit/environment/feature/package/dirty scope; otherwise it is warning metadata and does not suppress context.
- Selection is capped; truncation is reported as a warning.
- If query terms exist but no source matches, retrieval reports a warning instead of inventing context.
- Generic repo-shape terms such as `src`, `packages`, `workspace`, and `tests` are ignored as standalone search terms because they cause unrelated context bleed.

## Beta Boundary

The beta promise is reliable context transport over the Beta Retrieval V2 contract. Beta may promise deterministic TypeScript/JavaScript graph expansion for common modules, symbols, imports, exports, calls, related tests, and session-scoped observed-run result recall. For other languages, beta may promise safe file/path/lexical fallback only unless a provider and fixture prove stronger support. Beta does not promise embeddings, semantic ranking, complete call graphs, broad language AST support, runtime behavior correctness, root-cause proof, automatic conflict resolution, or automatic behavior claims from tests. Observed-run result claims prove that Grape observed one command/test result only.

The current TypeScript/JavaScript signal includes function declarations, class declarations, methods, interfaces, type aliases, constants, variables, const-assigned arrow/function declarations, static imports/exports, and direct call expressions. These graph facts guide source selection and excerpt anchoring, but exact excerpts remain source-existence proof only. Parsed project rules prove only that exact rule text exists in the scoped rule file; they do not infer generated policy or automatically resolve rule conflicts. Conservative `needs_review` edges remain review metadata; they do not deactivate claims by themselves.

## Polyglot And Monorepo Failure Modes

Current implementation can fail or become inefficient in these cases:

- nested `package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml` files are not modeled as package/workspace boundaries
- unsupported language files receive lexical/path fallback, but no language-aware symbols or imports
- Python, Java, Kotlin, Go, Rust, YAML, C#, Ruby, PHP, and shell relationships are not extracted as language-aware graph edges today
- JS/TS import resolution can miss aliases, package exports, generated code, framework routing, dynamic imports, and non-relative imports
- global source caps can select too much from one package in a monorepo
- checked-in polyglot and monorepo fixtures prove only safe fallback and explicit package-path scoping, not package-aware invalidation or full semantic graph coverage

Retrieval should surface these cases as blind spots or `partial_with_risk` rather than silently acting as a complete graph.

## Remaining Work

- provider dispatcher for normalized language index output
- package/workspace boundary detection
- per-package and per-language source budgets
- broader language extraction beyond TypeScript/JavaScript
- stronger TypeScript checker-backed declaration resolution
- richer exact-span ranking across tests and source files
- durable retrieval over broader claim/proof types beyond source excerpts and observed-run results
- richer conflict-aware ranking once broader durable claim types exist
