import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTaskSourceRetrieval,
  taskRetrievalTerms
} from "../../../.tmp/build/src/core/retrieval/index.js";

test("task retrieval terms split identifiers and ignore broad prompt words", () => {
  assert.deepEqual(
    taskRetrievalTerms({
      task: "Fix calculateDiscount refund flow in the repository",
      symbols: ["InvoiceController"]
    }),
    ["calculatediscount", "calculate", "discount", "refund", "flow", "invoicecontroller", "invoice", "controller"]
  );
});

test("task source retrieval merges explicit file and symbol seeds without broad lexical bleed", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount refund flow",
    sources: [
      source("source-auth", "src/auth.ts"),
      source("source-billing", "src/billing.ts"),
      source("source-readme", "README.md")
    ],
    symbols: [
      symbol("source-auth", "src/auth.ts", "createSession"),
      symbol("source-billing", "src/billing.ts", "calculateDiscount")
    ],
    lexicalMatches: [
      { sourceId: "source-readme", sourceRef: "README.md", matchedTerm: "refund" },
      { sourceId: "source-billing", sourceRef: "src/billing.ts", matchedTerm: "refund" },
      { sourceId: "source-missing", sourceRef: "src/missing.ts", matchedTerm: "refund" }
    ],
    seedFiles: ["./src/auth.ts", "../private.ts"],
    seedSymbols: ["calculateDiscount"]
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/auth.ts", "src/billing.ts"]);
  assert.deepEqual(result.explicitSourceRefs, ["src/auth.ts"]);
  assert.deepEqual(result.testSourceRefs, []);
  assert.deepEqual(result.relatedTestSourceRefs, []);
  assert.deepEqual(result.graphSourceRefs, []);
  assert.deepEqual(result.symbolSourceRefs, ["src/billing.ts"]);
  assert.deepEqual(result.lexicalSourceRefs, []);
  assert.deepEqual(result.sourceAnchors, [
    {
      sourceRef: "src/billing.ts",
      reason: "symbol_match",
      label: "calculateDiscount",
      startLine: 42,
      endLine: 44
    }
  ]);
  assert.ok(result.warnings.includes("task_seed_file_not_found:invalid"));
});

test("task source retrieval treats path-like test seeds as exact source inputs", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount refund flow",
    sources: [
      source("source-billing", "src/billing.ts"),
      source("source-billing-test", "tests/billing.test.ts")
    ],
    symbols: [symbol("source-billing", "src/billing.ts", "calculateDiscount")],
    lexicalMatches: [],
    seedTests: ["tests/billing.test.ts", "calculateDiscount regression", "tests/missing.test.ts", "../private.test.ts"]
  });

  assert.deepEqual(result.selectedSourceRefs, ["tests/billing.test.ts", "src/billing.ts"]);
  assert.deepEqual(result.testSourceRefs, ["tests/billing.test.ts"]);
  assert.deepEqual(result.symbolSourceRefs, ["src/billing.ts"]);
  assert.equal(result.queryTerms.includes("calculatediscount"), true);
  assert.equal(result.queryTerms.includes("regression"), true);
  assert.ok(result.warnings.includes("task_seed_test_not_found:tests/missing.test.ts"));
  assert.ok(result.warnings.includes("task_seed_test_not_found:invalid"));
  assert.equal(result.warnings.some((warning) => warning.includes("calculateDiscount regression")), false);
});

test("task source retrieval rejects absolute and drive-qualified seed paths", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount refund flow",
    sources: [source("source-billing", "src/billing.ts")],
    symbols: [],
    lexicalMatches: [],
    seedFiles: ["/src/billing.ts", "C:\\src\\billing.ts"]
  });

  assert.deepEqual(result.selectedSourceRefs, []);
  assert.deepEqual(result.explicitSourceRefs, []);
  assert.ok(result.warnings.includes("task_seed_file_not_found:invalid"));
});

test("task source retrieval includes related tests that import selected source files", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount refund flow",
    sources: [
      source("source-billing", "src/billing.ts"),
      source("source-billing-test", "tests/billing.test.ts"),
      source("source-readme", "README.md")
    ],
    symbols: [symbol("source-billing", "src/billing.ts", "calculateDiscount")],
    relationships: [
      {
        relationshipRef: "symbol_edge:billing-test-import",
        sourceRef: "tests/billing.test.ts",
        targetSourceRef: "src/billing.ts",
        relationship: "imports"
      },
      {
        sourceRef: "README.md",
        targetSourceRef: "src/billing.ts",
        relationship: "imports"
      }
    ],
    lexicalMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/billing.ts", "tests/billing.test.ts"]);
  assert.deepEqual(result.relatedTestSourceRefs, ["tests/billing.test.ts"]);
  assert.deepEqual(result.relatedTestRelationships, [
    {
      relationshipRef: "symbol_edge:billing-test-import",
      testSourceRef: "tests/billing.test.ts",
      targetSourceRef: "src/billing.ts",
      relationship: "imports"
    }
  ]);
  assert.deepEqual(result.graphSourceRefs, []);
  assert.deepEqual(result.symbolSourceRefs, ["src/billing.ts"]);
  assert.deepEqual(result.lexicalSourceRefs, []);
});

test("task source retrieval scopes broad matches when the task names a package source path", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix apiBillingTotal in packages/api/src/apiBilling.ts for packages/api",
    sources: [
      source("source-api", "packages/api/src/apiBilling.ts"),
      source("source-api-test", "packages/api/src/apiBilling.test.ts"),
      source("source-web", "packages/web/src/cart.ts"),
      source("source-web-test", "packages/web/src/cart.test.ts")
    ],
    symbols: [
      symbol("source-api", "packages/api/src/apiBilling.ts", "apiBillingTotal"),
      symbol("source-api-test", "packages/api/src/apiBilling.test.ts", "testApiBillingTotalIncludesProFee"),
      symbol("source-web", "packages/web/src/cart.ts", "webCartSubtotal"),
      symbol("source-web-test", "packages/web/src/cart.test.ts", "testWebCartSubtotal")
    ],
    relationships: [
      {
        sourceRef: "packages/api/src/apiBilling.test.ts",
        targetSourceRef: "packages/api/src/apiBilling.ts",
        relationship: "imports"
      },
      {
        sourceRef: "packages/web/src/cart.test.ts",
        targetSourceRef: "packages/web/src/cart.ts",
        relationship: "imports"
      }
    ],
    lexicalMatches: [
      { sourceId: "source-api", sourceRef: "packages/api/src/apiBilling.ts", matchedTerm: "total" },
      { sourceId: "source-api-test", sourceRef: "packages/api/src/apiBilling.test.ts", matchedTerm: "total" },
      { sourceId: "source-web", sourceRef: "packages/web/src/cart.ts", matchedTerm: "total" },
      { sourceId: "source-web-test", sourceRef: "packages/web/src/cart.test.ts", matchedTerm: "total" }
    ]
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "packages/api/src/apiBilling.ts",
    "packages/api/src/apiBilling.test.ts"
  ]);
  assert.deepEqual(result.explicitSourceRefs, ["packages/api/src/apiBilling.ts"]);
  assert.deepEqual(result.relatedTestSourceRefs, ["packages/api/src/apiBilling.test.ts"]);
  assert.deepEqual(result.lexicalSourceRefs, [
    "packages/api/src/apiBilling.ts",
    "packages/api/src/apiBilling.test.ts"
  ]);
  assert.equal(result.selectedSourceRefs.includes("packages/web/src/cart.ts"), false);
  assert.equal(result.selectedSourceRefs.includes("packages/web/src/cart.test.ts"), false);
});

test("task source retrieval scopes broad matches when a package test seed is exact input", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix package total calculation",
    sources: [
      source("source-api", "packages/api/src/apiBilling.ts"),
      source("source-api-test", "packages/api/src/apiBilling.test.ts"),
      source("source-web", "packages/web/src/cart.ts"),
      source("source-web-test", "packages/web/src/cart.test.ts")
    ],
    symbols: [
      symbol("source-api", "packages/api/src/apiBilling.ts", "apiBillingTotal"),
      symbol("source-web", "packages/web/src/cart.ts", "webCartTotal")
    ],
    relationships: [
      {
        sourceRef: "packages/api/src/apiBilling.test.ts",
        targetSourceRef: "packages/api/src/apiBilling.ts",
        relationship: "imports"
      },
      {
        sourceRef: "packages/web/src/cart.test.ts",
        targetSourceRef: "packages/web/src/cart.ts",
        relationship: "imports"
      }
    ],
    lexicalMatches: [
      { sourceId: "source-api", sourceRef: "packages/api/src/apiBilling.ts", matchedTerm: "total" },
      { sourceId: "source-web", sourceRef: "packages/web/src/cart.ts", matchedTerm: "total" }
    ],
    seedTests: ["packages/api/src/apiBilling.test.ts"]
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "packages/api/src/apiBilling.test.ts",
    "packages/api/src/apiBilling.ts"
  ]);
  assert.deepEqual(result.testSourceRefs, ["packages/api/src/apiBilling.test.ts"]);
  assert.equal(result.selectedSourceRefs.includes("packages/web/src/cart.ts"), false);
  assert.equal(result.selectedSourceRefs.includes("packages/web/src/cart.test.ts"), false);
});

test("task source retrieval scopes broad matches with indexed nested package roots", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix backend total in components/backend/src/service.py",
    sources: [
      source("backend-service", "components/backend/src/service.py"),
      source("backend-config", "components/backend/src/config.py"),
      source("web-service", "components/web/src/service.py")
    ],
    symbols: [
      symbol(
        "backend-service",
        "components/backend/src/service.py",
        "run_backend_service",
        "function",
        3,
        3,
        "components/backend"
      ),
      symbol(
        "backend-config",
        "components/backend/src/config.py",
        "backend_total_config",
        "function",
        3,
        3,
        "components/backend"
      ),
      symbol(
        "web-service",
        "components/web/src/service.py",
        "web_total",
        "function",
        3,
        3,
        "components/web"
      )
    ],
    lexicalMatches: [
      { sourceId: "backend-config", sourceRef: "components/backend/src/config.py", matchedTerm: "total" },
      { sourceId: "web-service", sourceRef: "components/web/src/service.py", matchedTerm: "total" }
    ]
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "components/backend/src/service.py",
    "components/backend/src/config.py"
  ]);
  assert.deepEqual(result.explicitSourceRefs, ["components/backend/src/service.py"]);
  assert.equal(result.selectedSourceRefs.includes("components/web/src/service.py"), false);
});

test("task source retrieval warns when selected implementation sources have no related tests", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount refund flow",
    sources: [source("source-billing", "src/billing.ts")],
    symbols: [symbol("source-billing", "src/billing.ts", "calculateDiscount")],
    relationships: [],
    lexicalMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/billing.ts"]);
  assert.deepEqual(result.relatedTestSourceRefs, []);
  assert.ok(result.warnings.includes("task_retrieval_no_related_tests_found"));
});

test("task source retrieval expands selected sources through graph relationships", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix runCheckout",
    sources: [
      source("source-checkout", "src/checkout.ts"),
      source("source-pricing", "src/pricing.ts"),
      source("source-pricing-test", "tests/pricing.test.ts")
    ],
    symbols: [symbol("source-checkout", "src/checkout.ts", "runCheckout")],
    relationships: [
      {
        sourceRef: "src/checkout.ts",
        targetSourceRef: "src/pricing.ts",
        relationship: "calls"
      },
      {
        sourceRef: "tests/pricing.test.ts",
        targetSourceRef: "src/pricing.ts",
        relationship: "calls"
      }
    ],
    lexicalMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/checkout.ts", "tests/pricing.test.ts", "src/pricing.ts"]);
  assert.deepEqual(result.symbolSourceRefs, ["src/checkout.ts"]);
  assert.deepEqual(result.graphSourceRefs, ["src/pricing.ts"]);
  assert.deepEqual(result.relatedTestSourceRefs, ["tests/pricing.test.ts"]);
});

test("task source retrieval includes related tests for lexical source matches", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Investigate invoice reconciliation",
    sources: [
      source("source-invoice", "src/invoice.ts"),
      source("source-invoice-test", "src/invoice.spec.ts")
    ],
    symbols: [],
    relationships: [
      {
        sourceRef: "src/invoice.spec.ts",
        targetSourceRef: "src/invoice.ts",
        relationship: "imports"
      }
    ],
    lexicalMatches: [{ sourceId: "source-invoice", sourceRef: "src/invoice.ts", matchedTerm: "invoice" }]
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/invoice.spec.ts", "src/invoice.ts"]);
  assert.deepEqual(result.lexicalSourceRefs, ["src/invoice.ts"]);
  assert.deepEqual(result.graphSourceRefs, []);
  assert.deepEqual(result.relatedTestSourceRefs, ["src/invoice.spec.ts"]);
});

test("task source retrieval warns when query terms find no source matches", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Investigate invoice reconciliation",
    sources: [source("source-readme", "README.md")],
    symbols: [],
    lexicalMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, []);
  assert.ok(result.warnings.includes("task_retrieval_no_source_matches"));
});

test("task source retrieval retains high-relevance tier-2 evidence over tier-3 graph noise when capped", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix refund reconciliation",
    maxSelectedSources: 2,
    sources: [
      source("source-anchor", "src/anchor.ts"),
      source("source-graph-1", "src/graph-1.ts"),
      source("source-graph-2", "src/graph-2.ts"),
      source("source-graph-3", "src/graph-3.ts"),
      source("source-graph-4", "src/graph-4.ts"),
      source("source-refund", "src/refund.ts")
    ],
    symbols: [symbol("source-refund", "src/refund.ts", "reconcileRefund")],
    relationships: [
      { sourceRef: "src/anchor.ts", targetSourceRef: "src/graph-1.ts", relationship: "imports" },
      { sourceRef: "src/anchor.ts", targetSourceRef: "src/graph-2.ts", relationship: "imports" },
      { sourceRef: "src/anchor.ts", targetSourceRef: "src/graph-3.ts", relationship: "imports" }
    ],
    lexicalMatches: [{ sourceId: "source-anchor", sourceRef: "src/anchor.ts", matchedTerm: "reconciliation" }]
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/refund.ts", "src/anchor.ts"]);
  assert.equal(result.selectedSourceRefs.includes("src/graph-3.ts"), false);
  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.some((warning) => warning.startsWith("task_retrieval_omitted_over_cap:")));
});

test("task source retrieval retains explicit source refs ahead of graph expansion when capped", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix billing total",
    maxSelectedSources: 3,
    sources: [
      source("source-explicit", "src/explicit.ts"),
      source("source-impl", "src/impl.ts"),
      source("source-graph-1", "src/graph-1.ts"),
      source("source-graph-2", "src/graph-2.ts"),
      source("source-graph-3", "src/graph-3.ts"),
      source("source-graph-4", "src/graph-4.ts")
    ],
    symbols: [symbol("source-impl", "src/impl.ts", "billingTotal")],
    relationships: [
      { sourceRef: "src/explicit.ts", targetSourceRef: "src/graph-1.ts", relationship: "imports" },
      { sourceRef: "src/graph-1.ts", targetSourceRef: "src/graph-2.ts", relationship: "imports" },
      { sourceRef: "src/graph-2.ts", targetSourceRef: "src/graph-3.ts", relationship: "imports" },
      { sourceRef: "src/graph-3.ts", targetSourceRef: "src/graph-4.ts", relationship: "imports" }
    ],
    lexicalMatches: [],
    seedFiles: ["src/explicit.ts"]
  });

  assert.equal(result.selectedSourceRefs.includes("src/explicit.ts"), true);
  assert.equal(result.selectedSourceRefs.includes("src/graph-1.ts"), true);
  assert.equal(result.selectedSourceRefs.includes("src/impl.ts"), false);
  assert.equal(result.selectedSourceRefs.includes("src/graph-4.ts"), false);
});

test("task source retrieval ranks explicit refs within tier when explicit refs exceed cap", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount in src/billing.ts",
    maxSelectedSources: 2,
    sources: [
      source("source-alpha", "src/alpha.ts"),
      source("source-billing", "src/billing.ts"),
      source("source-gamma", "src/gamma.ts")
    ],
    symbols: [],
    lexicalMatches: [],
    seedFiles: ["src/alpha.ts", "src/billing.ts", "src/gamma.ts"]
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/billing.ts", "src/alpha.ts"]);
  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.includes("task_retrieval_omitted_over_cap:1"));
});

test("task source retrieval bounds test seed reservation on default tasks", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix billing total",
    maxSelectedSources: 4,
    sources: [
      source("source-impl", "src/impl.ts"),
      source("source-test-1", "tests/a.test.ts"),
      source("source-test-2", "tests/b.test.ts"),
      source("source-test-3", "tests/c.test.ts"),
      source("source-test-4", "tests/d.test.ts")
    ],
    symbols: [symbol("source-impl", "src/impl.ts", "billingTotal")],
    relationships: [],
    lexicalMatches: [],
    seedFiles: ["src/impl.ts"],
    seedTests: [
      "tests/a.test.ts",
      "tests/b.test.ts",
      "tests/c.test.ts",
      "tests/d.test.ts"
    ]
  });

  assert.equal(result.selectedSourceRefs.includes("src/impl.ts"), true);
  assert.equal(result.testSourceRefs.length, 1);
  assert.equal(result.selectedSourceRefs.filter((sourceRef) => sourceRef.startsWith("tests/")).length, 1);
});

test("task source retrieval emits compact omitted-over-cap warnings", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix refund flow",
    maxSelectedSources: 2,
    sources: [
      source("source-a", "src/a.ts"),
      source("source-b", "src/b.ts"),
      source("source-c", "src/c.ts"),
      source("source-d", "src/d.ts")
    ],
    symbols: [],
    lexicalMatches: [
      { sourceId: "source-a", sourceRef: "src/a.ts", matchedTerm: "refund" },
      { sourceId: "source-b", sourceRef: "src/b.ts", matchedTerm: "refund" },
      { sourceId: "source-c", sourceRef: "src/c.ts", matchedTerm: "refund" },
      { sourceId: "source-d", sourceRef: "src/d.ts", matchedTerm: "refund" }
    ]
  });

  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.includes("task_retrieval_omitted_over_cap:2"));
  assert.equal(
    result.warnings.filter((w) => w.startsWith("task_retrieval_omitted_over_cap:")).length,
    1
  );
  assert.equal(
    result.warnings.some((w) => w.startsWith("task_retrieval_omitted_over_cap_sample:")),
    false,
    "sample warning must not appear in default compact output"
  );
});

test("task source retrieval keeps ranked refs and semantic candidates aligned with selected refs", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount refund flow",
    maxSelectedSources: 2,
    sources: [
      source("source-auth", "src/auth.ts"),
      source("source-billing", "src/billing.ts"),
      source("source-readme", "README.md")
    ],
    symbols: [
      symbol("source-auth", "src/auth.ts", "createSession"),
      symbol("source-billing", "src/billing.ts", "calculateDiscount")
    ],
    lexicalMatches: [
      { sourceId: "source-readme", sourceRef: "README.md", matchedTerm: "refund" },
      { sourceId: "source-billing", sourceRef: "src/billing.ts", matchedTerm: "refund" }
    ],
    seedFiles: ["./src/auth.ts"]
  });

  assert.deepEqual(result.rankedSourceRefs, result.selectedSourceRefs);
  assert.equal(
    result.semanticCandidates.every((candidate) => result.selectedSourceRefs.includes(candidate.sourceRef)),
    true
  );
});

test("task source retrieval does not use module path matches as exact anchors", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix billing calculateDiscount",
    sources: [source("source-billing", "src/billing.ts")],
    symbols: [
      symbol("source-billing", "src/billing.ts", "src/billing.ts", "module", 1, 1),
      symbol("source-billing", "src/billing.ts", "calculateDiscount", "function", 42, 44)
    ],
    lexicalMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/billing.ts"]);
  assert.deepEqual(result.sourceAnchors, [
    {
      sourceRef: "src/billing.ts",
      reason: "symbol_match",
      label: "calculateDiscount",
      startLine: 42,
      endLine: 44
    }
  ]);
});

function source(sourceId, sourceRef) {
  return {
    sourceId,
    sourceRef,
    sourceType: "repository_file"
  };
}

test("task source retrieval selectedSourceRefs never exceeds maxSelectedSources", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix refund checkout billing invoice",
    maxSelectedSources: 3,
    sources: [
      source("s-a", "src/a.ts"),
      source("s-b", "src/b.ts"),
      source("s-c", "src/c.ts"),
      source("s-d", "src/d.ts"),
      source("s-e", "src/e.ts")
    ],
    symbols: [],
    lexicalMatches: [
      { sourceId: "s-a", sourceRef: "src/a.ts", matchedTerm: "refund" },
      { sourceId: "s-b", sourceRef: "src/b.ts", matchedTerm: "checkout" },
      { sourceId: "s-c", sourceRef: "src/c.ts", matchedTerm: "billing" },
      { sourceId: "s-d", sourceRef: "src/d.ts", matchedTerm: "invoice" },
      { sourceId: "s-e", sourceRef: "src/e.ts", matchedTerm: "refund" }
    ]
  });

  assert.ok(
    result.selectedSourceRefs.length <= 3,
    "selectedSourceRefs must not exceed maxSelectedSources"
  );
});

test("task source retrieval test_focused kind bounds test seeds to ratio and absolute max", () => {
  const testSeedSources = Array.from({ length: 8 }, (_, i) =>
    source(`test-${i}`, `tests/feature-${i}.test.ts`)
  );
  const implSources = Array.from({ length: 4 }, (_, i) =>
    source(`impl-${i}`, `src/feature-${i}.ts`)
  );

  const result = resolveTaskSourceRetrieval({
    task: "Fix failing regression tests",
    maxSelectedSources: 8,
    sources: [...testSeedSources, ...implSources],
    symbols: [],
    lexicalMatches: implSources.map((s) => ({
      sourceId: s.sourceId,
      sourceRef: s.sourceRef,
      matchedTerm: "feature"
    })),
    seedTests: testSeedSources.map((s) => s.sourceRef)
  });

  const testRefsSelected = result.selectedSourceRefs.filter((ref) => ref.startsWith("tests/"));
  assert.ok(
    testRefsSelected.length <= 4,
    `test_focused seeds bounded to TEST_SEED_ABSOLUTE_MAX (4), got ${testRefsSelected.length}`
  );
  assert.ok(
    result.selectedSourceRefs.length <= 8,
    "global cap must hold"
  );
});

test("task source retrieval equal-score tie-break uses stable string order not insertion order", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix bug",
    maxSelectedSources: 10,
    sources: [
      source("s-z", "src/z.ts"),
      source("s-a", "src/a.ts"),
      source("s-m", "src/m.ts")
    ],
    symbols: [],
    lexicalMatches: [
      { sourceId: "s-z", sourceRef: "src/z.ts", matchedTerm: "bug" },
      { sourceId: "s-a", sourceRef: "src/a.ts", matchedTerm: "bug" },
      { sourceId: "s-m", sourceRef: "src/m.ts", matchedTerm: "bug" }
    ]
  });

  assert.deepEqual(
    result.selectedSourceRefs,
    ["src/a.ts", "src/m.ts", "src/z.ts"],
    "equal-score refs must appear in stable byte-string order, not insertion order"
  );
});

test("task source retrieval spreads lower-priority package refs before global cap", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix checkout total",
    maxSelectedSources: 4,
    sources: [
      source("api-a", "packages/api/src/checkout-a.ts"),
      source("api-b", "packages/api/src/checkout-b.ts"),
      source("api-c", "packages/api/src/checkout-c.ts"),
      source("api-d", "packages/api/src/checkout-d.ts"),
      source("web-a", "packages/web/src/checkout-a.ts"),
      source("web-b", "packages/web/src/checkout-b.ts")
    ],
    symbols: [],
    lexicalMatches: [
      { sourceId: "api-a", sourceRef: "packages/api/src/checkout-a.ts", matchedTerm: "total" },
      { sourceId: "api-b", sourceRef: "packages/api/src/checkout-b.ts", matchedTerm: "total" },
      { sourceId: "api-c", sourceRef: "packages/api/src/checkout-c.ts", matchedTerm: "total" },
      { sourceId: "api-d", sourceRef: "packages/api/src/checkout-d.ts", matchedTerm: "total" },
      { sourceId: "web-a", sourceRef: "packages/web/src/checkout-a.ts", matchedTerm: "total" },
      { sourceId: "web-b", sourceRef: "packages/web/src/checkout-b.ts", matchedTerm: "total" }
    ]
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "packages/api/src/checkout-a.ts",
    "packages/web/src/checkout-a.ts",
    "packages/api/src/checkout-b.ts",
    "packages/web/src/checkout-b.ts"
  ]);
  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.includes("task_retrieval_omitted_over_cap:2"));
});

test("task source retrieval spreads direct symbol matches across package roots before global cap", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix checkout total",
    maxSelectedSources: 4,
    sources: [
      source("api-a", "packages/api/src/checkout-a.ts"),
      source("api-b", "packages/api/src/checkout-b.ts"),
      source("api-c", "packages/api/src/checkout-c.ts"),
      source("api-d", "packages/api/src/checkout-d.ts"),
      source("web-a", "packages/web/src/checkout-a.ts"),
      source("web-b", "packages/web/src/checkout-b.ts")
    ],
    symbols: [
      symbol("api-a", "packages/api/src/checkout-a.ts", "checkoutTotal"),
      symbol("api-b", "packages/api/src/checkout-b.ts", "checkoutTotal"),
      symbol("api-c", "packages/api/src/checkout-c.ts", "checkoutTotal"),
      symbol("api-d", "packages/api/src/checkout-d.ts", "checkoutTotal"),
      symbol("web-a", "packages/web/src/checkout-a.ts", "checkoutTotal"),
      symbol("web-b", "packages/web/src/checkout-b.ts", "checkoutTotal")
    ],
    lexicalMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "packages/api/src/checkout-a.ts",
    "packages/web/src/checkout-a.ts",
    "packages/api/src/checkout-b.ts",
    "packages/web/src/checkout-b.ts"
  ]);
  assert.deepEqual(result.symbolSourceRefs, result.selectedSourceRefs);
  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.includes("task_retrieval_omitted_over_cap:2"));
});

test("task source retrieval spreads lower-priority refs using indexed nested package roots", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix order total",
    maxSelectedSources: 4,
    sources: [
      source("api-a", "components/api/src/a.py"),
      source("api-b", "components/api/src/b.py"),
      source("api-c", "components/api/src/c.py"),
      source("api-d", "components/api/src/d.py"),
      source("web-a", "components/web/src/a.py"),
      source("web-b", "components/web/src/b.py")
    ],
    symbols: [
      symbol("api-a", "components/api/src/a.py", "apiAlpha", "function", 1, 1, "components/api"),
      symbol("api-b", "components/api/src/b.py", "apiBravo", "function", 1, 1, "components/api"),
      symbol("api-c", "components/api/src/c.py", "apiCharlie", "function", 1, 1, "components/api"),
      symbol("api-d", "components/api/src/d.py", "apiDelta", "function", 1, 1, "components/api"),
      symbol("web-a", "components/web/src/a.py", "webAlpha", "function", 1, 1, "components/web"),
      symbol("web-b", "components/web/src/b.py", "webBravo", "function", 1, 1, "components/web")
    ],
    lexicalMatches: [
      { sourceId: "api-a", sourceRef: "components/api/src/a.py", matchedTerm: "total" },
      { sourceId: "api-b", sourceRef: "components/api/src/b.py", matchedTerm: "total" },
      { sourceId: "api-c", sourceRef: "components/api/src/c.py", matchedTerm: "total" },
      { sourceId: "api-d", sourceRef: "components/api/src/d.py", matchedTerm: "total" },
      { sourceId: "web-a", sourceRef: "components/web/src/a.py", matchedTerm: "total" },
      { sourceId: "web-b", sourceRef: "components/web/src/b.py", matchedTerm: "total" }
    ]
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "components/api/src/a.py",
    "components/web/src/a.py",
    "components/api/src/b.py",
    "components/web/src/b.py"
  ]);
  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.includes("task_retrieval_omitted_over_cap:2"));
});

test("task source retrieval no-candidate tie-break uses stable string order not seed order", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix",
    maxSelectedSources: 10,
    sources: [
      source("s-z", "src/z.ts"),
      source("s-a", "src/a.ts"),
      source("s-m", "src/m.ts")
    ],
    symbols: [],
    lexicalMatches: [],
    seedFiles: ["src/z.ts", "src/a.ts", "src/m.ts"]
  });

  assert.deepEqual(
    result.selectedSourceRefs,
    ["src/a.ts", "src/m.ts", "src/z.ts"],
    "refs without semantic candidates must use stable byte-string order, not seed order"
  );
});

test("task source retrieval warns when reserved test seed caps omit seed refs", () => {
  const testSeedSources = Array.from({ length: 8 }, (_, i) =>
    source(`test-${i}`, `tests/feature-${i}.test.ts`)
  );

  const result = resolveTaskSourceRetrieval({
    task: "Fix failing regression tests",
    maxSelectedSources: 8,
    sources: testSeedSources,
    symbols: [],
    lexicalMatches: [],
    seedTests: testSeedSources.map((s) => s.sourceRef)
  });

  assert.deepEqual(result.selectedSourceRefs, [
    "tests/feature-0.test.ts",
    "tests/feature-1.test.ts",
    "tests/feature-2.test.ts",
    "tests/feature-3.test.ts"
  ]);
  assert.ok(result.warnings.includes("task_retrieval_truncated"));
  assert.ok(result.warnings.includes("task_retrieval_omitted_over_cap:4"));
});

test("task source retrieval bounds missing seed ref warnings", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix seeded paths",
    sources: [],
    symbols: [],
    lexicalMatches: [],
    seedFiles: Array.from({ length: 7 }, (_, i) => `src/missing-${i}.ts`),
    seedTests: Array.from({ length: 7 }, (_, i) => `tests/missing-${i}.test.ts`)
  });

  assert.equal(
    result.warnings.filter((warning) => warning.startsWith("task_seed_file_not_found:")).length,
    5
  );
  assert.equal(
    result.warnings.filter((warning) => warning.startsWith("task_seed_test_not_found:")).length,
    5
  );
  assert.ok(result.warnings.includes("task_seed_file_not_found_omitted:2"));
  assert.ok(result.warnings.includes("task_seed_test_not_found_omitted:2"));
});

test("task source retrieval rankedSourceRefs equals selectedSourceRefs (beta contract)", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Fix calculateDiscount billing",
    sources: [
      source("s-auth", "src/auth.ts"),
      source("s-billing", "src/billing.ts")
    ],
    symbols: [symbol("s-billing", "src/billing.ts", "calculateDiscount")],
    lexicalMatches: [
      { sourceId: "s-billing", sourceRef: "src/billing.ts", matchedTerm: "billing" }
    ],
    seedFiles: ["./src/auth.ts"]
  });

  assert.deepEqual(
    result.rankedSourceRefs,
    result.selectedSourceRefs,
    "rankedSourceRefs must have the same membership and order as selectedSourceRefs"
  );
  assert.ok(result.selectedSourceRefs.length > 0);
});

function symbol(sourceId, path, name, symbolKind = "function", startLine, endLine, packageRoot) {
  const resolvedStartLine = startLine ?? (name === "calculateDiscount" ? 42 : 3);
  const resolvedEndLine = endLine ?? (name === "calculateDiscount" ? 44 : 3);
  return {
    sourceId,
    path,
    name,
    symbolKind,
    startLine: resolvedStartLine,
    endLine: resolvedEndLine,
    packageRoot
  };
}
