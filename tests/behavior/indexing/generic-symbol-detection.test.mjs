import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildFileIndex } from "../../../.tmp/build/src/core/indexing/index.js";

const fixtureRoot = path.join(process.cwd(), "tests/fixtures/polyglot-fallback-repo");
const now = "2026-06-12T00:00:00.000Z";

test("generic_text_fallback_detects_common_language_symbols", () => {
  const result = buildFileIndex({
    projectId: "project-1",
    repoId: "repo-1",
    snapshotId: "snapshot-1",
    rootPath: fixtureRoot,
    files: [
      source("src/grape_polyglot/pricing.py"),
      source("java/src/main/java/example/BillingPolicy.java"),
      source("kotlin/src/main/kotlin/example/AccessPolicy.kt"),
      source("go/refund/refund.go"),
      source("rust/src/lib.rs"),
      source("dotnet/BillingLimit.cs"),
      source("ruby/lib/refund_policy.rb"),
      source("php/src/TaxPolicy.php"),
      source("swift/Sources/Checkout/AccessWindow.swift"),
      source("native/src/retry_budget.c"),
      source("native/src/audit_bridge.cpp"),
      source("scripts/deploy-check.sh")
    ],
    createdAt: now
  });

  const nodeByPathAndName = new Map(result.nodes.map((node) => [`${node.path}:${node.name}`, node]));
  assertSymbol(nodeByPathAndName, "src/grape_polyglot/pricing.py", "PriceRequest", "class", "python");
  assertSymbol(nodeByPathAndName, "src/grape_polyglot/pricing.py", "calculate_member_total", "function", "python");
  assertSymbol(nodeByPathAndName, "java/src/main/java/example/BillingPolicy.java", "BillingPolicy", "class", "java");
  assertSymbol(nodeByPathAndName, "java/src/main/java/example/BillingPolicy.java", "retryWindowMinutes", "method", "java");
  assertSymbol(nodeByPathAndName, "kotlin/src/main/kotlin/example/AccessPolicy.kt", "requiresReview", "function", "kotlin");
  const goSymbol = assertSymbol(nodeByPathAndName, "go/refund/refund.go", "RefundHoldDays", "function", "go");
  assertSymbol(nodeByPathAndName, "rust/src/lib.rs", "inventory_reserve_window_minutes", "function", "rust");
  assertSymbol(nodeByPathAndName, "dotnet/BillingLimit.cs", "ApprovalThresholdCents", "constant", "csharp");
  assertSymbol(nodeByPathAndName, "ruby/lib/refund_policy.rb", "expedited_refund?", "method", "ruby");
  assertSymbol(nodeByPathAndName, "php/src/TaxPolicy.php", "vat_exemption_code", "method", "php");
  assertSymbol(nodeByPathAndName, "swift/Sources/Checkout/AccessWindow.swift", "staffOverrideHours", "constant", "swift");
  assertSymbol(nodeByPathAndName, "native/src/retry_budget.c", "retry_budget_seconds", "function", "c");
  assertSymbol(nodeByPathAndName, "native/src/audit_bridge.cpp", "audit_bridge_batch_size", "function", "cpp");
  assertSymbol(nodeByPathAndName, "scripts/deploy-check.sh", "deploy_guard_mode", "variable", "shell");

  assert.equal(goSymbol.metadata.extractor, "regex_basic");
  assert.equal(goSymbol.metadata.providerId, "generic_text");
  assert.deepEqual(goSymbol.metadata.providerCapabilities, ["lexical_path", "symbols_basic"]);
  assert.equal(
    goSymbol.metadata.providerDiagnostics.some(
      (diagnostic) => diagnostic.code === "provider_capability_gap" && diagnostic.capability === "module_edges"
    ),
    true
  );
  assert.equal(result.edges.some((edge) => edge.edgeType === "calls"), false);
});

function source(repoPath) {
  const bytes = readFileSync(path.join(fixtureRoot, repoPath));
  return {
    path: repoPath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sourceKind: "source",
    sourceId: `source:${repoPath}`
  };
}

function assertSymbol(nodeByPathAndName, repoPath, name, kind, language) {
  const node = nodeByPathAndName.get(`${repoPath}:${name}`);
  assert.ok(node, `missing ${repoPath}:${name}`);
  assert.equal(node.symbolKind, kind);
  assert.equal(node.language, language);
  assert.equal(node.confidence === "medium" || node.confidence === "low", true);
  assert.equal(node.metadata.providerId, "generic_text");
  assert.deepEqual(node.metadata.providerCapabilities, ["lexical_path", "symbols_basic"]);
  return node;
}
