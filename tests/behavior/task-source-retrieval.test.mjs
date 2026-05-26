import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTaskSourceRetrieval,
  taskRetrievalTerms
} from "../../.tmp/build/src/core/retrieval/index.js";

test("task retrieval terms split identifiers and ignore broad prompt words", () => {
  assert.deepEqual(
    taskRetrievalTerms({
      task: "Fix calculateDiscount refund flow in the repository",
      symbols: ["InvoiceController"]
    }),
    ["calculatediscount", "calculate", "discount", "refund", "flow", "invoicecontroller", "invoice", "controller"]
  );
});

test("task source retrieval merges explicit, symbol, and fts source matches", () => {
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
    ftsMatches: [
      { sourceId: "source-readme", sourceRef: "README.md", matchedTerm: "refund" },
      { sourceId: "source-billing", sourceRef: "src/billing.ts", matchedTerm: "refund" },
      { sourceId: "source-missing", sourceRef: "src/missing.ts", matchedTerm: "refund" }
    ],
    seedFiles: ["./src/auth.ts", "../private.ts"],
    seedSymbols: ["calculateDiscount"]
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/auth.ts", "src/billing.ts", "README.md"]);
  assert.deepEqual(result.explicitSourceRefs, ["src/auth.ts"]);
  assert.deepEqual(result.symbolSourceRefs, ["src/billing.ts"]);
  assert.deepEqual(result.ftsSourceRefs, ["src/billing.ts", "README.md"]);
  assert.ok(result.warnings.includes("task_seed_file_not_found:invalid"));
});

test("task source retrieval warns when query terms find no source matches", () => {
  const result = resolveTaskSourceRetrieval({
    task: "Investigate invoice reconciliation",
    sources: [source("source-readme", "README.md")],
    symbols: [],
    ftsMatches: []
  });

  assert.deepEqual(result.selectedSourceRefs, []);
  assert.ok(result.warnings.includes("task_retrieval_no_source_matches"));
});

function source(sourceId, sourceRef) {
  return {
    sourceId,
    sourceRef,
    sourceType: "repository_file"
  };
}

function symbol(sourceId, path, name) {
  return {
    sourceId,
    path,
    name
  };
}
