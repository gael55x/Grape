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

test("local source excerpts anchor around task query terms beyond the first window", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-source-excerpt-anchor-"));
  try {
    mkdirSync(path.join(rootPath, "src"));
    const sourceRef = "src/deep-auth.ts";
    const filler = Array.from({ length: 55 }, (_, index) => `const filler${index} = ${index};`);
    const targetLine = "export function rareSecurityHook() { return 'scoped'; }";
    const sourceText = [...filler, targetLine, "export const done = true;", ""].join("\n");
    writeFileSync(path.join(rootPath, sourceRef), sourceText);

    const source = {
      sourceId: "source-deep-auth",
      sourceType: "repository_file",
      sourceRef,
      sourceHash: sha256(Buffer.from(sourceText, "utf8")),
      sourceScope: "committed",
      privacyStatus: "allowed",
      trustClass: "trusted",
      redactionStatus: "not_needed"
    };

    const excerpts = readLocalSourceExcerpts({
      rootPath,
      sources: [source],
      preferredSourceRefs: [sourceRef],
      queryTerms: ["raresecurityhook"]
    });

    assert.equal(excerpts.length, 1);
    assert.ok(excerpts[0].startLine > 1);
    assert.ok(excerpts[0].startLine <= 56);
    assert.ok(excerpts[0].endLine >= 56);
    assert.match(excerpts[0].excerpt, /rareSecurityHook/);
    assert.doesNotMatch(excerpts[0].excerpt, /filler0/);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("local source excerpts prefer task-selected symbol anchors over earlier query matches", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-source-excerpt-symbol-anchor-"));
  try {
    mkdirSync(path.join(rootPath, "src"));
    const sourceRef = "src/checkout.ts";
    const earlyLine = "const refund = 'mentioned in setup comments';";
    const filler = Array.from({ length: 50 }, (_, index) => `const filler${index} = ${index};`);
    const targetLine = "export function calculateDiscount() { return 'refund'; }";
    const sourceText = [earlyLine, ...filler, targetLine, "export const done = true;", ""].join("\n");
    writeFileSync(path.join(rootPath, sourceRef), sourceText);

    const source = {
      sourceId: "source-checkout",
      sourceType: "repository_file",
      sourceRef,
      sourceHash: sha256(Buffer.from(sourceText, "utf8")),
      sourceScope: "committed",
      privacyStatus: "allowed",
      trustClass: "trusted",
      redactionStatus: "not_needed"
    };

    const excerpts = readLocalSourceExcerpts({
      rootPath,
      sources: [source],
      preferredSourceRefs: [sourceRef],
      queryTerms: ["refund"],
      sourceAnchors: [
        {
          sourceRef,
          reason: "symbol_match",
          label: "calculateDiscount",
          startLine: 52,
          endLine: 52
        }
      ]
    });

    assert.equal(excerpts.length, 1);
    assert.ok(excerpts[0].startLine > 1);
    assert.ok(excerpts[0].endLine >= 52);
    assert.match(excerpts[0].excerpt, /calculateDiscount/);
    assert.doesNotMatch(excerpts[0].excerpt, /mentioned in setup comments/);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("local source excerpts can return multiple non-overlapping query windows when no anchors exist", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-source-excerpt-multi-query-"));
  try {
    mkdirSync(path.join(rootPath, "src"));
    const sourceRef = "src/query-windows.ts";
    const firstFiller = Array.from({ length: 20 }, (_, index) => `const first${index} = ${index};`);
    const middleFiller = Array.from({ length: 55 }, (_, index) => `const middle${index} = ${index};`);
    const sourceText = [
      ...firstFiller,
      "export function checkoutPolicyDraft() { return 'draft'; }",
      ...middleFiller,
      "export function checkoutPolicyPublish() { return 'publish'; }",
      ""
    ].join("\n");
    writeFileSync(path.join(rootPath, sourceRef), sourceText);

    const source = {
      sourceId: "source-query-windows",
      sourceType: "repository_file",
      sourceRef,
      sourceHash: sha256(Buffer.from(sourceText, "utf8")),
      sourceScope: "committed",
      privacyStatus: "allowed",
      trustClass: "trusted",
      redactionStatus: "not_needed"
    };

    const excerpts = readLocalSourceExcerpts({
      rootPath,
      sources: [source],
      preferredSourceRefs: [sourceRef],
      queryTerms: ["checkoutpolicy"]
    });

    assert.equal(excerpts.length, 2);
    assert.match(excerpts[0].excerpt, /checkoutPolicyDraft/);
    assert.doesNotMatch(excerpts[0].excerpt, /checkoutPolicyPublish/);
    assert.match(excerpts[1].excerpt, /checkoutPolicyPublish/);
    assert.doesNotMatch(excerpts[1].excerpt, /checkoutPolicyDraft/);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("local source excerpts can return multiple non-overlapping symbol windows for one source", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-source-excerpt-multi-anchor-"));
  try {
    mkdirSync(path.join(rootPath, "src"));
    const sourceRef = "src/workflow.ts";
    const firstFiller = Array.from({ length: 20 }, (_, index) => `const first${index} = ${index};`);
    const middleFiller = Array.from({ length: 55 }, (_, index) => `const middle${index} = ${index};`);
    const sourceText = [
      ...firstFiller,
      "export function prepareInvoice() { return 'prepared'; }",
      ...middleFiller,
      "export function settleInvoice() { return 'settled'; }",
      ""
    ].join("\n");
    writeFileSync(path.join(rootPath, sourceRef), sourceText);

    const source = {
      sourceId: "source-workflow",
      sourceType: "repository_file",
      sourceRef,
      sourceHash: sha256(Buffer.from(sourceText, "utf8")),
      sourceScope: "committed",
      privacyStatus: "allowed",
      trustClass: "trusted",
      redactionStatus: "not_needed"
    };

    const excerpts = readLocalSourceExcerpts({
      rootPath,
      sources: [source],
      preferredSourceRefs: [sourceRef],
      sourceAnchors: [
        {
          sourceRef,
          reason: "symbol_match",
          label: "prepareInvoice",
          startLine: 21,
          endLine: 21
        },
        {
          sourceRef,
          reason: "symbol_match",
          label: "settleInvoice",
          startLine: 77,
          endLine: 77
        }
      ]
    });

    assert.equal(excerpts.length, 2);
    assert.match(excerpts[0].excerpt, /prepareInvoice/);
    assert.doesNotMatch(excerpts[0].excerpt, /settleInvoice/);
    assert.match(excerpts[1].excerpt, /settleInvoice/);
    assert.doesNotMatch(excerpts[1].excerpt, /prepareInvoice/);
    assert.notEqual(excerpts[0].proofId, excerpts[1].proofId);
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

test("preferred task source refs exclude generic exact-source filler", () => {
  const sources = [
    ...Array.from({ length: 6 }, (_, index) => sourceInput(`src/source-${index}.ts`, "repository_file")),
    sourceInput("src/z-task.ts", "repository_file")
  ];
  const sourceExcerpts = sources.map((source) => sourceExcerpt(source.sourceRef, source.sourceType));

  assert.deepEqual(
    selectedExactSourceSources(sources, ["src/z-task.ts"]).map((source) => source.sourceRef),
    ["src/z-task.ts"]
  );
  assert.deepEqual(
    selectedSourceExcerpts(sourceExcerpts, ["src/z-task.ts"]).map((excerpt) => excerpt.sourceRef),
    ["src/z-task.ts"]
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
