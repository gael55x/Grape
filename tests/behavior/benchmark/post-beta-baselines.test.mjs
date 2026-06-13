import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildLayerMetrics,
  classifySelection,
  extractGrapeRefLayers,
  resolveSearchEngine,
  runSearchBaseline
} from "../../../benchmarks/scripts/lib/baselines.mjs";

const monorrepoCaseDef = {
  id: "retrieval_monorepo",
  knownIrrelevantFiles: ["packages/web/src/cart.ts", "packages/web/src/cart.test.ts"],
  knownIrrelevantPrefixes: ["packages/web/"],
  expectedRelevantFiles: [
    "packages/api/src/apiBilling.ts",
    "packages/api/src/apiBilling.test.ts",
    "packages/api/package.json"
  ],
  searchQueries: ["apiBilling"]
};

function makeCompileOutput({ retrievalRefs = [], evidenceRefs = [], ruleRefs = [], packItemRefs = [] } = {}) {
  return {
    contextArtifact: {
      outputSections: [
        {
          id: "task-retrieval",
          sourceRefs: retrievalRefs,
          itemRefs: [],
          text: ""
        },
        {
          id: "exact-source-evidence",
          sourceRefs: evidenceRefs,
          itemRefs: []
        },
        {
          id: "active-project-rules",
          sourceRefs: ruleRefs,
          itemRefs: []
        }
      ]
    },
    contextPackItems: packItemRefs.map((ref, i) => ({
      id: `item-${i}`,
      inputRefs: [{ ref, kind: "source_file", scope: {} }]
    }))
  };
}

test("extractGrapeRefLayers separates retrieval, evidence, rules, pack, and final refs", () => {
  const output = makeCompileOutput({
    retrievalRefs: ["packages/api/src/apiBilling.ts", "packages/api/src/apiBilling.test.ts"],
    evidenceRefs: ["packages/api/src/apiBilling.ts"],
    ruleRefs: ["AGENTS.md"],
    packItemRefs: ["packages/web/src/cart.ts", "packages/api/package.json"]
  });

  const layers = extractGrapeRefLayers(output);

  assert.deepEqual(layers.retrievalSelectedRefs, [
    "packages/api/src/apiBilling.test.ts",
    "packages/api/src/apiBilling.ts"
  ]);
  assert.deepEqual(layers.evidenceRefs, ["packages/api/src/apiBilling.ts"]);
  assert.deepEqual(layers.projectRuleRefs, ["AGENTS.md"]);
  assert.ok(layers.packInputRefs.includes("packages/web/src/cart.ts"), "pack should include web cart");
  assert.ok(layers.packInputRefs.includes("packages/api/package.json"), "pack should include api pkg");

  // finalAgentFacingRefs = union of retrieval + evidence + rules (not pack)
  assert.ok(layers.finalAgentFacingRefs.includes("packages/api/src/apiBilling.ts"));
  assert.ok(layers.finalAgentFacingRefs.includes("AGENTS.md"));
  assert.equal(
    layers.finalAgentFacingRefs.includes("packages/web/src/cart.ts"),
    false,
    "finalAgentFacingRefs must not include pack-only refs"
  );
});

test("extractGrapeRefLayers returns empty arrays for empty output", () => {
  const layers = extractGrapeRefLayers({ contextArtifact: null, contextPackItems: [] });
  assert.deepEqual(layers.retrievalSelectedRefs, []);
  assert.deepEqual(layers.evidenceRefs, []);
  assert.deepEqual(layers.projectRuleRefs, []);
  assert.deepEqual(layers.packInputRefs, []);
  assert.deepEqual(layers.finalAgentFacingRefs, []);
});

test("buildLayerMetrics classifies known-irrelevant files per layer", () => {
  const layers = {
    retrievalSelectedRefs: ["packages/api/src/apiBilling.ts"],
    evidenceRefs: [],
    projectRuleRefs: [],
    packInputRefs: ["packages/web/src/cart.ts"],
    finalAgentFacingRefs: ["packages/api/src/apiBilling.ts"]
  };

  const metrics = buildLayerMetrics(layers, monorrepoCaseDef);

  assert.equal(metrics.retrievalSelectedRefs.knownIrrelevantFilesSelected.length, 0);
  assert.equal(metrics.packInputRefs.knownIrrelevantFilesSelected.length, 1);
  assert.deepEqual(metrics.packInputRefs.knownIrrelevantFilesSelected, ["packages/web/src/cart.ts"]);
  assert.equal(metrics.finalAgentFacingRefs.knownIrrelevantFilesSelected.length, 0);
});

test("buildLayerMetrics reports correct relevance recall per layer", () => {
  const layers = {
    retrievalSelectedRefs: ["packages/api/src/apiBilling.ts", "packages/api/src/apiBilling.test.ts"],
    evidenceRefs: ["packages/api/src/apiBilling.ts"],
    projectRuleRefs: [],
    packInputRefs: [],
    finalAgentFacingRefs: ["packages/api/src/apiBilling.ts", "packages/api/src/apiBilling.test.ts"]
  };

  const metrics = buildLayerMetrics(layers, monorrepoCaseDef);

  // retrieval found 2 of 3 expected files
  assert.equal(metrics.retrievalSelectedRefs.relevanceRecall, 2 / 3);
  // final found 2 of 3
  assert.equal(metrics.finalAgentFacingRefs.relevanceRecall, 2 / 3);
  // project rules found 0 of 3
  assert.equal(metrics.projectRuleRefs.relevanceRecall, 0);
});

test("resolveSearchEngine returns node-fallback when rg is absent or rg", () => {
  const result = resolveSearchEngine();
  assert.ok(
    result.searchEngine === "rg" || result.searchEngine === "node-fallback",
    `searchEngine should be 'rg' or 'node-fallback', got: ${result.searchEngine}`
  );
  if (result.searchEngine === "rg") {
    assert.ok(typeof result.binary === "string" && result.binary.length > 0);
  } else {
    assert.equal(result.binary, null);
  }
});

test("runSearchBaseline with node-fallback finds files matching query strings", () => {
  const workDir = mkdtempSync(path.join(tmpdir(), "grape-test-search-"));
  const srcDir = path.join(workDir, "src");
  mkdirSync(srcDir, { recursive: true });

  try {
    writeFileSync(path.join(srcDir, "billing.ts"), "export function apiBillingTotal() { return 0; }");
    writeFileSync(path.join(srcDir, "cart.ts"), "export function cartTotal() { return 0; }");
    writeFileSync(path.join(workDir, "README.md"), "# My project\napiBilling info");

    const caseDef = {
      id: "test_case",
      searchQueries: ["apiBilling"],
      knownIrrelevantFiles: [],
      knownIrrelevantPrefixes: [],
      expectedRelevantFiles: []
    };

    const engine = { searchEngine: "node-fallback", binary: null };
    const result = runSearchBaseline(workDir, caseDef, "uncapped", 65536, engine);

    assert.equal(result.searchEngine, "node-fallback");
    assert.ok(result.files.includes("src/billing.ts"), "should find billing.ts containing apiBilling");
    assert.ok(result.files.includes("README.md"), "should find README.md containing apiBilling");
    assert.equal(result.files.includes("src/cart.ts"), false, "should not find cart.ts");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test("classifySelection identifies known-irrelevant files from prefix", () => {
  const selected = ["packages/api/src/apiBilling.ts", "packages/web/package.json"];
  const result = classifySelection(selected, monorrepoCaseDef);
  assert.deepEqual(result.knownIrrelevantFilesSelected, ["packages/web/package.json"]);
  assert.equal(result.knownIrrelevantFilesSelectedCount, 1);
});
