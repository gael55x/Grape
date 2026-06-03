# ADR-0011: Language Provider Capabilities

## Status

Accepted

## Context

Grape needs to work in real repositories, including polyglot monorepos, without expanding V1 into a universal code-intelligence product. Current indexing is useful for TypeScript/JavaScript and safe lexical fallback, but broad language support can easily introduce bad tradeoffs:

- parser-specific assumptions leaking into retrieval policy
- false confidence for unsupported languages
- monorepo package boundaries flattened into one global source pool
- graph facts being mistaken for proof
- beta claims exceeding fixture coverage

ADR-0010 anchors V1 on context transport. Language indexing should support that transport goal by improving source selection and excerpt anchoring, not by becoming the product's primary promise.

## Decision

V1 language indexing is capability-based.

Language and framework extractors must be owned as indexing providers. Providers emit normalized nodes, edges, capability metadata, diagnostics, and blind spots. Retrieval and compiler modules consume the normalized shape and decide what context is selected and rendered.

Provider facts are orientation only. Exact source excerpts, proof rows, dependency manifests, current-valid filtering, and session diff rules remain authoritative.

Unsupported languages, parser failures, dynamic/reflection-heavy code, framework magic, generated code, and unknown workspace boundaries must degrade safely to exact/path/lexical context plus explicit warnings.

Monorepo support must preserve package/workspace boundaries when they are known. Package-local manifests and lockfiles should become dependency refs for selected package context, and retrieval should avoid allowing unrelated packages or languages to exhaust the context budget.

## Consequences

- Broad language work belongs under `src/core/indexing/languages/` or focused indexing modules before retrieval/compiler policy changes.
- Storage can continue using normalized `symbol_nodes`, `symbol_edges`, and metadata until first-class provider/package tables are justified by tests.
- Beta can claim safe polyglot fallback, not broad polyglot graph completeness.
- New language providers need fixtures and capability-gap tests before product claims change.
- Monorepo claims need package/workspace fixtures and package-scoped invalidation tests.

## Alternatives

- **Universal parser in V1:** Rejected. This contradicts the V1 scope boundary and delays transport proof.
- **Keep TS/JS hard-coded forever:** Rejected. It blocks a clean path to polyglot support and hides unsupported-language gaps.
- **Treat graph facts as proof:** Rejected. This violates trust and proof invariants.
- **Use a separate graph product as the core:** Rejected for V1. External graph tools can be orientation inputs, but Grape remains local-first context transport.

## Supersedes

None.

## Related Spec Sections

- `docs/v1/SPEC.md` §5.2, §6.4, §17
- `docs/v1/core/language-indexing.md`
- `docs/v1/core/retrieval.md`
- `docs/v1/architecture/overview.md`
- `docs/v1/decisions/adr-0010-context-transport-protocol.md`
