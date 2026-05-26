import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readLocalSourceExcerpts } from "../../.tmp/build/src/app/index.js";
import {
  selectedExactSourceSources,
  selectedProofSourceExcerpts,
  selectedRuleSourceExcerpts,
  selectedSourceExcerpts
} from "../../.tmp/build/src/core/compiler/index.js";

test("local source excerpts require matching source bytes and safe repo paths", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-source-excerpts-"));
  try {
    mkdirSync(path.join(rootPath, "src"));
    const sourceRef = "src/app.ts";
    const sourcePath = path.join(rootPath, sourceRef);
    const sourceText = "export function runApp() {\n  return true;\n}\n";
    writeFileSync(sourcePath, sourceText);

    const source = {
      sourceId: "source-1",
      sourceType: "repository_file",
      sourceRef,
      sourceHash: sha256(Buffer.from(sourceText, "utf8")),
      sourceScope: "committed",
      privacyStatus: "allowed",
      trustClass: "trusted",
      redactionStatus: "not_needed"
    };

    const excerpts = readLocalSourceExcerpts({ rootPath, sources: [source] });
    assert.equal(excerpts.length, 1);
    assert.equal(excerpts[0].sourceRef, sourceRef);
    assert.match(excerpts[0].proofId, /^proof:/);
    assert.match(excerpts[0].excerpt, /export function runApp/);

    writeFileSync(sourcePath, "export function runApp() {\n  return false;\n}\n");
    assert.deepEqual(readLocalSourceExcerpts({ rootPath, sources: [source] }), []);

    assert.doesNotThrow(() =>
      readLocalSourceExcerpts({
        rootPath,
        sources: [{ ...source, sourceId: "source-unsafe", sourceRef: "../secret.txt" }]
      })
    );
    assert.deepEqual(
      readLocalSourceExcerpts({
        rootPath,
        sources: [{ ...source, sourceId: "source-unsafe", sourceRef: "../secret.txt" }]
      }),
      []
    );
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("rule excerpt selection is independent from generic exact-source excerpt cap", () => {
  const sourceExcerpts = [
    ...Array.from({ length: 6 }, (_, index) => sourceExcerpt(`src/source-${index}.ts`, "repository_file")),
    sourceExcerpt("zz-rule.md", "rule_file")
  ];

  assert.deepEqual(
    selectedSourceExcerpts(sourceExcerpts).map((excerpt) => excerpt.sourceRef),
    ["src/source-0.ts", "src/source-1.ts", "src/source-2.ts", "src/source-3.ts", "src/source-4.ts"]
  );
  assert.deepEqual(
    selectedRuleSourceExcerpts(sourceExcerpts).map((excerpt) => excerpt.sourceRef),
    ["zz-rule.md"]
  );
  assert.deepEqual(
    selectedProofSourceExcerpts(sourceExcerpts).map((excerpt) => excerpt.sourceRef),
    ["src/source-0.ts", "src/source-1.ts", "src/source-2.ts", "src/source-3.ts", "src/source-4.ts", "zz-rule.md"]
  );
});

test("rule source selection is independent from generic exact-source source cap", () => {
  const sources = [
    ...Array.from({ length: 6 }, (_, index) => sourceInput(`src/source-${index}.ts`, "repository_file")),
    sourceInput("zz-rule.md", "rule_file")
  ];

  assert.deepEqual(
    selectedExactSourceSources(sources).map((source) => source.sourceRef),
    ["src/source-0.ts", "src/source-1.ts", "src/source-2.ts", "src/source-3.ts", "src/source-4.ts", "zz-rule.md"]
  );
});

test("preferred task source refs are selected before generic exact-source cap", () => {
  const sources = [
    ...Array.from({ length: 6 }, (_, index) => sourceInput(`src/source-${index}.ts`, "repository_file")),
    sourceInput("src/z-task.ts", "repository_file")
  ];
  const sourceExcerpts = sources.map((source) => sourceExcerpt(source.sourceRef, source.sourceType));

  assert.deepEqual(
    selectedExactSourceSources(sources, ["src/z-task.ts"]).map((source) => source.sourceRef),
    ["src/z-task.ts", "src/source-0.ts", "src/source-1.ts", "src/source-2.ts", "src/source-3.ts"]
  );
  assert.deepEqual(
    selectedSourceExcerpts(sourceExcerpts, ["src/z-task.ts"]).map((excerpt) => excerpt.sourceRef),
    ["src/z-task.ts", "src/source-0.ts", "src/source-1.ts", "src/source-2.ts", "src/source-3.ts"]
  );
});

function sourceInput(sourceRef, sourceType) {
  return {
    sourceId: `source:${sourceRef}`,
    sourceType,
    sourceRef,
    sourceHash: "a".repeat(64),
    sourceScope: "committed",
    trustClass: "trusted",
    privacyStatus: "allowed",
    redactionStatus: "not_needed"
  };
}

function sourceExcerpt(sourceRef, sourceType) {
  return {
    proofId: `proof:${sourceRef}`,
    sourceId: `source:${sourceRef}`,
    sourceType,
    sourceRef,
    sourceHash: "a".repeat(64),
    sourceScope: "committed",
    excerpt: "content",
    excerptHash: "b".repeat(64),
    startLine: 1,
    endLine: 1,
    truncated: false
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
