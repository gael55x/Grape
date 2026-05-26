import assert from "node:assert/strict";
import test from "node:test";

import { evaluateContextPackBudget } from "../../.tmp/build/src/core/compiler/index.js";

test("context budget evaluator reports over-budget packs without pruning required context", () => {
  const result = evaluateContextPackBudget({
    tokenBudget: 10,
    estimatedPackTokens: 20,
    contextPackItems: [
      packItem("rules", 4, { pinned: true }),
      packItem("summary", 16)
    ]
  });

  assert.equal(result.status, "over_budget");
  assert.equal(result.requiredContextTokens, 4);
  assert.deepEqual(result.warnings, ["token_budget_exceeded_without_pruning"]);
  assert.deepEqual(result.unsafeReasons, []);
});

test("context budget evaluator rejects budgets below required context", () => {
  const result = evaluateContextPackBudget({
    tokenBudget: 3,
    estimatedPackTokens: 20,
    contextPackItems: [
      packItem("rules", 4, { pinned: true }),
      packItem("summary", 16)
    ]
  });

  assert.equal(result.status, "required_context_exceeds_budget");
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.unsafeReasons, ["token_budget_below_required_context"]);
});

function packItem(id, tokenCount, overrides = {}) {
  return {
    id,
    state: overrides.state ?? "NEW",
    itemKind: "context_summary",
    itemRef: id,
    sectionId: id,
    title: id,
    content: "x".repeat(tokenCount * 4),
    contentHash: "a".repeat(64),
    tokenCount,
    pinned: overrides.pinned ?? false,
    safetyCritical: overrides.safetyCritical ?? false,
    inputRefs: [],
    warnings: []
  };
}
