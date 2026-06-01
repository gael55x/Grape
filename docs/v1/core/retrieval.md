# Retrieval

V1 retrieval is intentionally conservative. It selects current repository context from allowed, hash-verified local sources and exposes blind spots rather than claiming complete code-intelligence coverage.

## Beta Retrieval V2 Contract

Beta Retrieval V2 upgrades the current lightweight selector into a deterministic retrieval planner for TypeScript and JavaScript repositories. It may use AST-backed graph facts to expand task context, but exact source excerpts, rule text, proof rows, dependency manifests, and current-valid claim filtering remain the authority.

The beta planner may include:

- explicit file, symbol, and test seeds
- safe lexical matches from allowed current-snapshot sources
- AST-backed TypeScript/JavaScript module, export, import, symbol, method, call, and test/source relationship edges
- current-valid source-excerpt claims
- current-valid observed-run result claims
- parsed durable project-rule claims once rule parsing lands
- deterministic conflict/supersession filters once conflict creation lands

The beta planner must not:

- treat graph expansion as proof
- include ignored/private/secret-looking source bodies
- promote behavior, correctness, root-cause, or fix-result claims from observed command/test runs
- use model summaries or compression artifacts as proof
- claim complete semantic search, embeddings, or full multi-language graph coverage

## Current Inputs

The current retrieval path may use:

- explicit file, symbol, and test seeds from CLI/MCP requests
- Git-visible source records from the current snapshot
- safe portable lexical search rows built from allowed source records
- AST-backed TypeScript/JavaScript symbol nodes for modules, functions, classes, methods, interfaces, types, constants, and variables
- local import/export/call relationships discovered from AST traversal where supported
- current-valid narrow source-excerpt claims after proof validation
- current-valid narrow observed-run result claims after trusted local `grape run` / `grape test` promotion

Private, ignored, unreadable, oversized, binary, stale-hash, and secret-looking files are not valid retrieval inputs.

## Selection Rules

Task source retrieval is an impact candidate selector, not relevance ranking over durable truth.

- Explicit seed files are selected first when they exist in the current snapshot.
- Path-like test seeds may select matching test files as exact source context.
- Symbol matches may select source files and line anchors for exact excerpt windows.
- Graph expansion may select directly related source files through supported import and call edges.
- Related tests may be selected when a test imports or calls a selected source file.
- Lexical matches may add source refs from safe indexed text.
- Selection is capped; truncation is reported as a warning.
- If query terms exist but no source matches, retrieval reports a warning instead of inventing context.

## Beta Boundary

The beta promise is reliable context transport over the Beta Retrieval V2 contract. Beta may promise deterministic TypeScript/JavaScript graph expansion for common modules, symbols, imports, exports, calls, and related tests. Beta does not promise embeddings, semantic ranking, complete call graphs, broad language AST support, runtime behavior correctness, root-cause proof, automatic conflict resolution, or automatic behavior claims from tests. Observed-run result claims prove that Grape observed one command/test result only.

The current TypeScript/JavaScript signal includes function declarations, class declarations, methods, interfaces, type aliases, constants, variables, const-assigned arrow/function declarations, static imports/exports, and direct call expressions. These graph facts guide source selection and excerpt anchoring, but exact excerpts remain source-existence proof only.

## Remaining Work

- broader language extraction beyond TypeScript/JavaScript
- stronger TypeScript checker-backed declaration resolution
- richer exact-span ranking across tests and source files
- durable retrieval over broader claim/proof types beyond source excerpts and observed-run results
- conflict-aware and rule-aware retrieval once those durable workflows exist
