import assert from "node:assert/strict";
import test from "node:test";

import { createObservedRunClaimDraft } from "../../../.tmp/build/src/core/claims/observed-run-claims.js";
import { createObservedTestFailureRelationClaimDraft } from "../../../.tmp/build/src/core/claims/observed-test-failure-relation-claims.js";
import { createPackageManifestDependencyClaimDraft } from "../../../.tmp/build/src/core/claims/package-manifest-dependency-claims.js";
import { createProjectRuleClaimDraft } from "../../../.tmp/build/src/core/claims/project-rule-claims.js";
import { createSourceExcerptClaimDraft } from "../../../.tmp/build/src/core/claims/source-excerpt-claims.js";
import { createSymbolDeclarationClaimDraft } from "../../../.tmp/build/src/core/claims/symbol-declaration-claims.js";
import { activeClaimsSection } from "../../../.tmp/build/src/core/compiler/repository/sections/builders/active-claims.js";
import {
  assertConservativeTrustWording,
  findForbiddenTrustWording,
  FORBIDDEN_TRUST_WORDING_PATTERNS,
  SCOPED_DURABLE_CLAIMS_SECTION_FOOTER,
  SCOPED_DURABLE_CLAIMS_SECTION_TITLE,
  verificationStatusLabel
} from "../../../.tmp/build/src/shared/trust-wording.js";
import { recordLocalCandidate } from "../../../.tmp/build/src/app/local-project/writes/candidates.js";

const FORBIDDEN_PHRASE_SAMPLES = [
  "this is correct",
  "this definitely caused the bug",
  "this code is wrong",
  "this fix is proven correct",
  "guaranteed root cause",
  "proven fix",
  "root cause confirmed",
  "Grape guarantees every agent uses this context",
  "benchmark-proven savings",
  "semantic result is proof"
];

test("forbidden trust wording patterns detect overclaim phrases", () => {
  for (const phrase of FORBIDDEN_PHRASE_SAMPLES) {
    assert.ok(findForbiddenTrustWording(phrase).length > 0, `expected violation for: ${phrase}`);
  }
});

test("assertConservativeTrustWording rejects forbidden phrases", () => {
  assert.throws(
    () => assertConservativeTrustWording("proven fix for the bug", "test"),
    /forbidden trust wording/
  );
});

test("durable claim generators avoid forbidden root-cause and fix-proof wording", () => {
  const observedRun = createObservedRunClaimDraft({
    sourceId: "source:test",
    sourceType: "test_run",
    sourceRef: "test-run:abc",
    sourceHash: "a".repeat(64),
    sourceScope: { kind: "external", ref: "test-run:abc" },
    resultHash: "b".repeat(64),
    metadata: {
      observedRunId: "observed-run-1",
      commandHash: "c".repeat(64),
      cwd: ".",
      exitCode: 1,
      stdoutHash: "d".repeat(64),
      stderrHash: "e".repeat(64),
      startedAt: "2026-06-08T00:00:00.000Z",
      endedAt: "2026-06-08T00:00:01.000Z",
      branch: "main",
      commit: "f".repeat(40),
      worktreeHash: "g".repeat(64),
      sessionId: "session-1",
      snapshotId: "snapshot-1",
      passed: false
    }
  });
  assert.match(observedRun.claimText, /proves only that Grape observed this run result/i);
  assertNoForbiddenPhrases(observedRun.claimText);

  const manifest = createPackageManifestDependencyClaimDraft({
    branch: "main",
    commit: "a".repeat(40),
    worktreeHash: "b".repeat(64),
    entry: {
      sourceId: "source:pkg",
      sourceRef: "packages/api/package.json",
      sourceHash: "c".repeat(64),
      sourceScope: "committed",
      manifestKind: "npm_package",
      manifestRef: "packages/api/package.json",
      packageRootRef: "packages/api",
      packageRoot: "packages/api",
      dependencyName: "grape-api-client",
      dependencySection: "dependencies",
      dependencySpecifierHash: "d".repeat(64),
      entryHash: "e".repeat(64),
      startLine: 4,
      endLine: 4,
      providerId: "generic_manifest",
      providerCapabilities: ["package_roots"]
    }
  });
  assert.match(manifest.claimText, /Manifest declares dependency grape-api-client\./);
  assert.match(manifest.claimText, /manifest entry declaration only/i);
  assertNoForbiddenPhrases(manifest.claimText);

  const symbol = createSymbolDeclarationClaimDraft({
    branch: "main",
    commit: "a".repeat(40),
    worktreeHash: "b".repeat(64),
    source: {
      sourceId: "source:sym",
      sourceType: "repository_file",
      sourceRef: "src/app.ts",
      sourceHash: "c".repeat(64),
      sourceScope: "committed",
      trustClass: "trusted",
      privacyStatus: "allowed",
      redactionStatus: "not_needed",
      metadataJson: JSON.stringify({ sourceKind: "source" })
    },
    symbol: {
      symbolId: "sym:1",
      sourceId: "source:sym",
      name: "runApp",
      symbolKind: "function",
      startLine: 1,
      endLine: 1,
      bodyHash: "d".repeat(64),
      confidence: "high",
      metadataJson: JSON.stringify({ extractor: "typescript_ast" })
    }
  });
  assert.match(symbol.claimText, /declaration span exists/i);
  assertNoForbiddenPhrases(symbol.claimText);

  const excerpt = createSourceExcerptClaimDraft({
    branch: "main",
    commit: "a".repeat(40),
    worktreeHash: "b".repeat(64),
    excerpt: {
      proofId: "proof:1",
      sourceId: "source:excerpt",
      sourceRef: "src/app.ts",
      sourceHash: "c".repeat(64),
      sourceScope: "committed",
      excerptHash: "d".repeat(64),
      startLine: 1,
      endLine: 3
    }
  });
  assert.match(excerpt.claimText, /exact excerpt existence in scoped source only/i);
  assertNoForbiddenPhrases(excerpt.claimText);

  const rule = createProjectRuleClaimDraft({
    branch: "main",
    commit: "a".repeat(40),
    worktreeHash: "b".repeat(64),
    rule: {
      sourceId: "source:rule",
      sourceRef: "AGENTS.md",
      sourceHash: "c".repeat(64),
      sourceScope: "committed",
      sourceExcerptProofId: "proof:rule",
      sourceExcerptHash: "d".repeat(64),
      line: 1,
      ruleText: "Prefer focused tests for changed behavior.",
      ruleHash: "e".repeat(64),
      parser: "deterministic_rule_line_v1"
    }
  });
  assert.match(rule.claimText, /Repository rule text \(not Grape enforcement\)/i);
  assertNoForbiddenPhrases(rule.claimText);

  const failureLink = createObservedTestFailureRelationClaimDraft({
    sourceId: "source:test",
    sourceRef: "test-run:fail",
    sourceHash: "a".repeat(64),
    observedRunId: "observed-run-fail",
    observedRunClaimId: "claim:run",
    observedRunProofId: "proof:run",
    relationHash: "b".repeat(64),
    observedCommand: { commandHash: "c".repeat(64), cwd: "." },
    failureOutput: {
      stdoutHash: "d".repeat(64),
      stderrHash: "e".repeat(64),
      failureOutputHash: "f".repeat(64)
    },
    candidateLinks: [
      {
        testSpan: { sourceRef: "tests/app.test.ts", proofRef: "proof:test", startLine: 1, endLine: 3 },
        candidateSourceSpan: { sourceRef: "src/app.ts", proofRef: "proof:src", startLine: 1, endLine: 5 },
        evidence: { importEdge: false, filenameConvention: true, packageBoundary: false, manifestPackageRoot: false },
        warnings: []
      }
    ],
    linkedSourceRefs: ["src/app.ts"],
    observedRunMaterial: {
      sourceId: "source:test",
      sourceType: "test_run",
      sourceRef: "test-run:fail",
      sourceHash: "a".repeat(64),
      sourceScope: { kind: "external", ref: "test-run:fail" },
      resultHash: "g".repeat(64),
      metadata: {
        observedRunId: "observed-run-fail",
        commandHash: "c".repeat(64),
        cwd: ".",
        exitCode: 1,
        stdoutHash: "d".repeat(64),
        stderrHash: "e".repeat(64),
        startedAt: "2026-06-08T00:00:00.000Z",
        endedAt: "2026-06-08T00:00:01.000Z",
        branch: "main",
        commit: "h".repeat(40),
        worktreeHash: "i".repeat(64),
        sessionId: "session-1",
        snapshotId: "snapshot-1",
        passed: false
      }
    }
  });
  assert.match(failureLink.claimText, /candidate source\/test spans/i);
  assert.match(failureLink.claimText, /does not prove root cause/i);
  assertNoForbiddenPhrases(failureLink.claimText);
});

test("active claims artifact section uses conservative scoped title and footer", () => {
  const section = activeClaimsSection(
    {
      activeClaims: [
        {
          claimId: "claim:1",
          claimType: "grape_observed_run_result",
          claimText: "Grape observed test run observed-run-1 failed with exit code 1.",
          sourceRefs: ["test-run:abc"],
          proofRefs: ["proof:1"]
        }
      ]
    },
    []
  );

  assert.equal(section?.title, SCOPED_DURABLE_CLAIMS_SECTION_TITLE);
  assert.match(section?.body ?? "", new RegExp(escapeRegExp(SCOPED_DURABLE_CLAIMS_SECTION_FOOTER)));
  assertNoForbiddenPhrases(section?.body ?? "");
});

test("verification status label avoids correctness overclaim", () => {
  assert.equal(verificationStatusLabel("verified"), "proof_policy_accepted (verified)");
  assert.equal(verificationStatusLabel("partially_verified"), "partially_verified");
});

test("mcp candidate claim text rejects forbidden trust wording", () => {
  assert.throws(
    () =>
      recordLocalCandidate({
        rootPath: "/tmp/not-a-real-grape-project",
        sessionId: "session-1",
        subject: "src/app.ts",
        claimType: "assistant_response",
        claimText: "This is the guaranteed root cause and proven fix.",
        scope: {}
      }),
    /forbidden trust wording/
  );
});

function assertNoForbiddenPhrases(text) {
  const violations = findForbiddenTrustWording(text);
  assert.equal(violations.length, 0, `unexpected violations: ${violations.join(", ")}`);
  for (const { pattern } of FORBIDDEN_TRUST_WORDING_PATTERNS) {
    assert.doesNotMatch(text, pattern);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
