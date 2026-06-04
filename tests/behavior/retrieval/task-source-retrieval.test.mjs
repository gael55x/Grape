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

test("task source retrieval merges explicit, symbol, and lexical source matches", () => {
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

  assert.deepEqual(result.selectedSourceRefs, ["src/auth.ts", "src/billing.ts", "README.md"]);
  assert.deepEqual(result.explicitSourceRefs, ["src/auth.ts"]);
  assert.deepEqual(result.testSourceRefs, []);
  assert.deepEqual(result.relatedTestSourceRefs, []);
  assert.deepEqual(result.graphSourceRefs, []);
  assert.deepEqual(result.symbolSourceRefs, ["src/billing.ts"]);
  assert.deepEqual(result.lexicalSourceRefs, ["src/billing.ts", "README.md"]);
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

  assert.deepEqual(result.selectedSourceRefs, ["src/checkout.ts", "src/pricing.ts", "tests/pricing.test.ts"]);
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

  assert.deepEqual(result.selectedSourceRefs, ["src/invoice.ts", "src/invoice.spec.ts"]);
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

function symbol(sourceId, path, name, symbolKind = "function", startLine, endLine) {
  const resolvedStartLine = startLine ?? (name === "calculateDiscount" ? 42 : 3);
  const resolvedEndLine = endLine ?? (name === "calculateDiscount" ? 44 : 3);
  return {
    sourceId,
    path,
    name,
    symbolKind,
    startLine: resolvedStartLine,
    endLine: resolvedEndLine
  };
}
