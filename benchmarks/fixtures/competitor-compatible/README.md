# Competitor-compatible fixture

The **competitor-compatible** scenario uses `tests/fixtures/clean-typescript-app` (TypeScript discount/cart task) so Grape, Graphify, and partial comparators share:

- Same repo layout (`src/calculateDiscount.ts`, tests, rules)
- Same default task: `Explain calculateDiscount behavior and the tests that cover it.`
- Same evaluation rubric (usefulness 1–5, provenance/freshness checks)

Copy path for external tools:

```text
<repo-root>/tests/fixtures/clean-typescript-app
```

Do not add Grape-specific files to this tree for comparator runs.
