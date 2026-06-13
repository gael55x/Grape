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
- current-valid provider-backed symbol declaration claims
- current-valid provider-backed package manifest dependency claims
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
current-valid rejection. Rendered retrieval and relationship sections must use
selection-evidence wording and must not imply semantic authority, proof of
behavior, root cause, or fix validity.

Current implementation exposes advisory `semantic_candidate` rows from a local
deterministic scorer over task query terms, symbol names, path segments, and
lexical matches. Selection is tier-aware and rank-before-cap:

- **Tier 1A** explicit user source refs (`explicit_seed`): highest priority after validation; may use the full cap but are not immune beyond it. When explicit refs exceed the cap, Grape ranks within Tier 1A and omits extras.
- **Tier 1B** path-like test/failure seeds (`test_seed`): bounded reservation via named ratio policy so tests do not crowd out all source evidence on default tasks.
- **Tier 2** exact task/symbol/test-relationship evidence (`symbol_match`, `related_test`).
- **Tier 3** expansion candidates (`graph_related`, `lexical_match`).

Grape ranks semantically within each tier, then fills `selectedSourceRefs` in tier-priority order until `maxSelectedSources`. `rankedSourceRefs` contains the final selected source refs in deterministic retrieval-priority order with the same membership and order as `selectedSourceRefs`. Retrieval priority is tier-aware; it is not a pure global semantic-score ordering and user seed order is not a ranking signal. Equal-score refs within a tier are broken by stable byte-string comparison for cross-environment determinism. Semantic candidates in artifacts are filtered to selected refs only.

When Grape finds path-like test seeds, it reserves their capped slots by limiting explicit seed fill if the global cap can fit at least one explicit source ref and one test seed ref. With a one-source cap, explicit source refs keep Tier 1A priority because Grape cannot fit both roles safely.

When any tier includes two or more workspace package roots, Grape spreads the already-ranked refs across package roots before that tier fills its source slots. Refs without known package metadata stay eligible, but they fill after known package roots get the first spread pass. Within each package group, selected refs with known language metadata are also spread by language. If no package roots are known but selected refs carry language metadata, Grape spreads that tier across languages before the global cap applies. Refs without known language metadata stay eligible, but they fill after known language groups get the first spread pass. Within Tier 2 package/language groups, Grape also spreads exact evidence roles so direct symbol matches and related-test refs do not let one role spend every small source cap before the other role appears. Explicit seeds and path-like test seeds still keep their tier priority and reservation caps, but they no longer spend every in-tier slot in one known package or fallback language while another package or language has equal-priority evidence.

Truncation emits compact warnings: `task_retrieval_truncated` and `task_retrieval_omitted_over_cap:<count>` (the numeric count only). If caps leave one or more package roots with no selected source, Grape also emits `task_retrieval_package_groups_omitted_over_cap:<count>`. If caps leave one or more known source languages with no selected source, Grape emits `task_retrieval_language_groups_omitted_over_cap:<count>`. If truncation leaves one or more seeded package roots with no selected source, Grape also emits the more specific `task_retrieval_seed_packages_omitted_over_cap:<count>`. If truncation leaves one or more seeded source languages with no selected source, Grape emits `task_retrieval_seed_languages_omitted_over_cap:<count>`. These warnings do not list package names, language names, or file paths. Missing explicit seed refs emit at most five per seed kind, then a count-only omitted warning. Semantic candidates are not proofs, not durable claims, and are not accepted by `proof_policy_accepted`. This is a correctness fix for retrieval selection, not a benchmark claim.

## Current Inputs

The current retrieval path may use:

- explicit file, symbol, and test seeds from CLI/MCP requests
- Git-visible source records from the current snapshot
- safe portable lexical search rows built from allowed source records
- AST-backed TypeScript/JavaScript symbol nodes for modules, functions, classes, methods, interfaces, types, constants, and variables
- local import/export/call relationships discovered from AST traversal where supported
- file-level module nodes, lexical rows, and conservative declaration anchors for fallback languages where source text is safe to index
- current-valid narrow source-excerpt claims after proof validation
- current-valid narrow symbol declaration claims after high-confidence AST extraction and provider proof validation
- current-valid narrow observed-run result claims after trusted local `grape run` / `grape test` promotion

Private, ignored, unreadable, oversized, binary, stale-hash, and secret-looking files are not valid retrieval inputs.

## Selection Rules

Task source retrieval is an impact candidate selector, not relevance ranking over durable truth.

- Explicit seed files receive Tier 1A priority when they exist in the current snapshot, but may still be omitted when they exceed the source cap after within-tier ranking.
- Source file paths mentioned directly in the task are treated as explicit source anchors when they match current snapshot files.
- When a task or seed names exact source refs, broad lexical expansion stays on those refs unless the refs identify one common workspace root or indexed package-root metadata names one nested package root. If refs identify a common workspace root under `packages/<name>/`, `apps/<name>/`, `services/<name>/`, or `libs/<name>/`, or a selected ref carries manifest-derived package-root metadata, symbol and lexical expansion can stay inside that package before global caps apply. Direct graph relationships and explicit seed symbol or test-name matches can still add sources.
- Path-like test seeds may select matching test files as exact source context.
- Symbol matches may select source files and line anchors for exact excerpt windows. For TS/JS, symbols come from AST extraction. For common fallback source languages, symbols come from conservative declaration-line detection and remain best-effort anchors only.
- Graph expansion may select directly related source files through supported import and call edges.
- Related tests may be selected when a test imports or calls a selected source file.
- When a related test is selected through an import/call edge, the task-retrieval section should render the test/source relationship as selection evidence only. When the relationship came from the indexed symbol graph, the section should include the stable relationship ref and dependency ref for traceability. This relationship does not prove the test was run, that the test covers the behavior, or that the implementation is correct.
- Lexical matches may add source refs from safe indexed text.
- Lexical repository search uses storage-bounded SQL prefiltering and a bounded deterministic normalized fallback so punctuation/case matching does not require scanning every stored text row.
- In monorepos and mixed-language repos, explicit seed refs should be interpreted inside their package/workspace when known, and source budgets should avoid allowing unrelated packages or one fallback language to exhaust Tier 2 direct evidence or Tier 3 expansion context.
- Current-valid filtering may use a package root only when explicit file/task/test refs resolve to exactly one common workspace root under `packages/`, `apps/`, `services/`, or `libs/`, or exactly one manifest-backed package root from index metadata. Mixed package roots, root-level `src/`, lexical-only matches, and graph-expanded refs do not create a package-root current scope.
- Package-scoped source-excerpt, project-rule, symbol declaration, and npm manifest dependency claims require a matching current package root. Broad repo/root claims without package scope remain eligible, but missing package discovery still means Grape must not claim complete package-aware invalidation.
- Caller-supplied feature flags may filter current-valid claims whose scope already contains matching `featureFlag` or `featureFlags` data, but only allowlisted flag names are accepted as current scope. Public artifacts and MCP/CLI output expose only feature-flag count and a deterministic scope hash, not flag labels or values. They do not create claims, prove runtime behavior, or appear as raw public output values.
- Package-local manifests and lockfiles become dependency refs for selected package context when explicit refs identify one common package/workspace root or selected refs carry manifest-derived package-root index metadata. Task, exact-evidence, and claim sections that use that package context carry those refs so a package-local manifest or lockfile change invalidates prior sent context.
- Current-valid `grape_observed_run_result` claims from the current compile session may be rendered with task-scoped claims only when no selected refs exist, or when an observed test-run claim has explicit safe `testFiles` metadata matching a selected ref. Compile sessions are task-bound, and current-valid checks still require matching branch, commit, worktree hash, source hash, result hash, and any caller-supplied environment scope. Explicit test file refs are task relevance metadata only; they do not prove coverage, behavior, correctness, or root cause.
- Current-valid `observed_test_failure_span_link` claims from the current compile session may render when linked test/source refs or explicit safe `testFiles` metadata intersect selected task refs. They require matching branch, commit, worktree hash, test-run source hash, relation hash, and external test-run source scope. They prove only that a failed Grape-observed test run is linked to candidate spans from available evidence. They do not prove root cause, code wrongness, or fix validity.
- Current-valid parsed `project_rule` claims may render with task-scoped claims, while exact rule text remains pinned in the active-project-rules section.
- Current-valid `repository_symbol_declaration_exists` claims may render only for task-selected source refs covered by accepted exact source excerpt windows. They prove declaration-span existence only and do not prove import/export behavior, call graph completeness, runtime behavior, correctness, root cause, ownership, or architecture conclusions.
- Current-valid `package_manifest_dependency_exists` claims may render for task-selected refs in the same current package root, or when the manifest itself is selected. They prove only that the npm manifest declares the dependency entry. They do not prove the dependency is installed, imported, used, required by runtime, safe, valid, lockfile-resolved, or correctly configured.
- Current-valid filtering rejects claims blocked by active claim edges after shared scope compatibility is resolved. Unresolved `contradicts` edges block both claims when scopes overlap or overlap is unknown; disjoint scopes do not deactivate either claim. Unresolved `violates` edges block the violating source claim when scopes overlap or overlap is unknown. Compatible `supersedes` edges block the superseded target claim until an applicable manual resolution edge says the claims may coexist or are variants. A `supersedes` edge is compatible only when the linked claims have matching claim type, resolved subject, exact source ref, and compatible branch/commit/environment/feature/package/dirty scope; otherwise it is warning metadata and does not suppress context.
- Selection is capped after tier-aware ranking; truncation is reported with compact capped warnings, not unbounded per-ref lists in default agent-facing output.
- If query terms exist but no source matches, retrieval reports a warning instead of inventing context.
- Generic repo-shape terms such as `src`, `packages`, `workspace`, and `tests` are ignored as standalone search terms because they cause unrelated context bleed.

## Beta Boundary

The beta promise is reliable context transport over the Beta Retrieval V2 contract. Beta may promise deterministic TypeScript/JavaScript graph expansion for common modules, symbols, imports, exports, calls, related tests, and session-scoped observed-run result recall. For other languages, beta may promise safe file/path/lexical fallback only unless a provider and fixture prove stronger support. Beta does not promise embeddings, semantic ranking, complete call graphs, broad language AST support, runtime behavior correctness, root-cause proof, automatic conflict resolution, or automatic behavior claims from tests. Observed-run result claims prove that Grape observed one command/test result only.

The current TypeScript/JavaScript signal includes function declarations, class declarations, methods, interfaces, type aliases, constants, variables, const-assigned arrow/function declarations, static imports/exports, and direct call expressions. These graph facts guide source selection and excerpt anchoring, but exact excerpts remain source-existence proof only. Parsed project rules prove only that exact rule text exists in the scoped rule file; they do not infer generated policy or automatically resolve rule conflicts. Npm manifest dependency claims prove only declaration in `package.json`. Conservative `needs_review` edges remain review metadata; they do not deactivate claims by themselves.

## Polyglot And Monorepo Failure Modes

Current implementation can fail or become inefficient in these cases:

- nested `package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml` files can scope selected source retrieval and dependency-back selected package context through index metadata. Manifest-backed package roots can also participate in current-valid package scope for exact refs and supported claim types. They still do not create full workspace budgets, dependency closure, or non-npm manifest dependency claims
- unsupported language files receive lexical/path fallback, and common fallback source languages can receive conservative declaration anchors, but non-TS/JS files still do not receive language-aware imports or test relationships
- Python, Java, Kotlin, Go, Rust, YAML, C#, Ruby, PHP, Swift, C, C++, and shell relationships are not extracted as language-aware graph edges today
- JS/TS import resolution can miss aliases, package exports, generated code, framework routing, dynamic imports, and non-relative imports
- global source caps can still omit seeded packages or languages when explicit or test seeds outnumber available source slots, or when package and language metadata are unknown; tier spreading uses common-prefix package roots, manifest-derived package roots, and indexed source language metadata, not full per-package or per-language budgets
- checked-in polyglot and monorepo fixtures prove safe fallback, explicit package-path scoping, manifest-derived nested package scoping, package-scoped current-valid filtering, and selected package manifest dependency refs, not full workspace graph coverage

Retrieval should surface these cases as blind spots or `partial_with_risk` rather than silently acting as a complete graph.

## Remaining Work

- provider dispatcher for normalized language index output
- package/workspace boundary detection
- full per-package and per-language source budgets
- broader language extraction beyond TypeScript/JavaScript
- stronger TypeScript checker-backed declaration resolution
- richer exact-span ranking across tests and source files
- durable retrieval over broader claim/proof types beyond source excerpts and observed-run results
- richer conflict-aware ranking once broader durable claim types exist
