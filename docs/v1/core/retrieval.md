# Retrieval

V1 retrieval is intentionally conservative. It selects current repository context from allowed, hash-verified local sources and exposes blind spots rather than claiming full code-intelligence coverage.

## Current Inputs

The current retrieval path may use:

- explicit file, symbol, and test seeds from CLI/MCP requests
- Git-visible source records from the current snapshot
- safe portable lexical search rows built from allowed source records
- lightweight symbol nodes for modules, functions, classes, interfaces, types, constants, and variables
- local import relationships discovered from static import specifiers
- current-valid narrow source-excerpt claims after proof validation

Private, ignored, unreadable, oversized, binary, stale-hash, and secret-looking files are not valid retrieval inputs.

## Selection Rules

Task source retrieval is an impact candidate selector, not relevance ranking over durable truth.

- Explicit seed files are selected first when they exist in the current snapshot.
- Path-like test seeds may select matching test files as exact source context.
- Symbol matches may select source files and line anchors for exact excerpt windows.
- Related tests may be selected when a test imports a selected source file.
- Lexical matches may add source refs from safe indexed text.
- Selection is capped; truncation is reported as a warning.
- If query terms exist but no source matches, retrieval reports a warning instead of inventing context.

## Beta Boundary

The beta promise is reliable context transport over this lightweight retrieval contract. Beta does not promise complete call graphs, semantic ranking, broad language AST support, runtime behavior proof, or durable project-rule reasoning.

The current TypeScript/JavaScript signal includes function declarations, class declarations, interfaces, type aliases, constants, variables, and const-assigned arrow/function declarations. These symbols guide source selection and excerpt anchoring, but exact excerpts remain source-existence proof only.

## Remaining Work

- broader language extraction and AST-backed symbol spans
- stronger TypeScript compiler-backed import and declaration resolution
- richer exact-span ranking across tests and source files
- durable retrieval over broader claim/proof types
- conflict-aware and rule-aware retrieval once those durable workflows exist
