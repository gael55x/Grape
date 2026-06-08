import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaskSemanticCandidates,
  orderSourceRefsBySemanticCandidates,
  resolveTaskSourceRetrieval,
  SEMANTIC_CANDIDATE_ADVISORY_LABEL,
  SEMANTIC_CANDIDATE_SECTION_HEADER,
  SEMANTIC_CANDIDATE_TYPE
} from "../../../.tmp/build/src/core/retrieval/index.js";
import { evaluateDurableClaimPolicy } from "../../../.tmp/build/src/core/claims/claim-policy.js";
import {
  assertConservativeTrustWording,
  findForbiddenTrustWording,
  TRUST_WORDING_DISCLAIMERS
} from "../../../.tmp/build/src/shared/trust-wording.js";
import { compileRepositoryContextArtifact } from "../../../.tmp/build/src/core/compiler/index.js";

test("semantic candidates are generated for relevant task and symbol input", () => {
  const candidates = buildTaskSemanticCandidates({
    sourceRefs: ["src/billing.ts", "src/auth.ts", "README.md"],
    symbols: [
      { sourceId: "source-billing", path: "src/billing.ts", name: "calculateDiscount" },
      { sourceId: "source-auth", path: "src/auth.ts", name: "createSession" }
    ],
    queryTerms: ["calculatediscount", "refund"],
    lexicalMatches: [
      { sourceId: "source-billing", sourceRef: "src/billing.ts", matchedTerm: "refund" },
      { sourceId: "source-readme", sourceRef: "README.md", matchedTerm: "refund" }
    ]
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.sourceRef, "src/billing.ts");
  assert.equal(candidates[0]?.candidateType, SEMANTIC_CANDIDATE_TYPE);
  assert.ok(candidates[0]?.score > candidates[1]?.score);
  assert.ok(candidates[0]?.matchedSignals.some((signal) => signal.startsWith("symbol:")));
});

test("semantic candidates reorder ranked refs without changing selected membership", () => {
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
      { sourceId: "source-billing", sourceRef: "src/billing.ts", matchedTerm: "refund" }
    ],
    seedFiles: ["./src/auth.ts"],
    seedSymbols: ["calculateDiscount"]
  });

  assert.deepEqual(result.selectedSourceRefs, ["src/auth.ts", "src/billing.ts", "README.md"]);
  assert.deepEqual(result.rankedSourceRefs, ["src/billing.ts", "README.md", "src/auth.ts"]);
  assert.equal(result.rankedSourceRefs[0], "src/billing.ts");
  assert.equal(new Set(result.rankedSourceRefs).size, result.selectedSourceRefs.length);
  assert.ok(result.semanticCandidates.length > 0);
});

test("orderSourceRefsBySemanticCandidates preserves stable order on score ties", () => {
  const ordered = orderSourceRefsBySemanticCandidates(
    ["src/a.ts", "src/b.ts"],
    [
      {
        candidateType: SEMANTIC_CANDIDATE_TYPE,
        sourceRef: "src/a.ts",
        score: 2,
        matchedSignals: ["path:a"],
        advisoryLabel: SEMANTIC_CANDIDATE_ADVISORY_LABEL
      },
      {
        candidateType: SEMANTIC_CANDIDATE_TYPE,
        sourceRef: "src/b.ts",
        score: 2,
        matchedSignals: ["path:b"],
        advisoryLabel: SEMANTIC_CANDIDATE_ADVISORY_LABEL
      }
    ]
  );

  assert.deepEqual(ordered, ["src/a.ts", "src/b.ts"]);
});

test("semantic_candidate proof signal is rejected by durable claim policy", () => {
  const result = evaluateDurableClaimPolicy({
    claimType: "repository_source_excerpt_exists",
    claimMeaning: "source_excerpt_exists",
    proofType: "exact_source_excerpt",
    sourceType: "repository_file",
    supportStatus: "direct",
    sourceTrustClass: "trusted",
    sourcePrivacyStatus: "allowed",
    sourceRedactionStatus: "none",
    observer: "local_source_reader",
    proofSignalKind: "semantic_candidate"
  });

  assert.equal(result.accepted, false);
  assert.equal(result.reason, "semantic_candidate_not_proof");
});

test("semantic candidate advisory wording avoids forbidden trust phrases", () => {
  assert.deepEqual(findForbiddenTrustWording(SEMANTIC_CANDIDATE_ADVISORY_LABEL), []);
  assert.deepEqual(findForbiddenTrustWording(SEMANTIC_CANDIDATE_SECTION_HEADER), []);
  assert.doesNotThrow(() =>
    assertConservativeTrustWording(TRUST_WORDING_DISCLAIMERS.semanticCandidateSectionHeader, "section header")
  );
});

test("repository artifact task retrieval section labels semantic candidates as advisory", () => {
  const artifact = compileRepositoryContextArtifact(minimalArtifactInput({
    taskRetrieval: {
      selectedSourceRefs: ["src/billing.ts"],
      rankedSourceRefs: ["src/billing.ts"],
      semanticCandidates: [
        {
          candidateType: "semantic_candidate",
          sourceRef: "src/billing.ts",
          score: 8,
          matchedSignals: ["symbol:calculateDiscount:calculatediscount"],
          advisoryLabel: SEMANTIC_CANDIDATE_ADVISORY_LABEL
        }
      ],
      explicitSourceRefs: ["src/billing.ts"],
      testSourceRefs: [],
      relatedTestSourceRefs: [],
      relatedTestRelationships: [],
      graphSourceRefs: [],
      symbolSourceRefs: ["src/billing.ts"],
      lexicalSourceRefs: [],
      queryTerms: ["calculatediscount"],
      warnings: []
    }
  }));

  const retrieval = artifact.sections.find((section) => section.id === "task-retrieval");
  assert.match(retrieval?.body ?? "", /Advisory semantic candidates \(ranking only; non-authoritative; not proof; not a durable claim\):/);
  assert.match(retrieval?.body ?? "", /advisory ranking signal \(non-authoritative; not proof; not a durable claim\)/);
  assert.match(retrieval?.body ?? "", /Semantic-ranked source refs \(advisory ordering only; not proof\):/);
});

test("semantic candidates are not represented as durable active claims in artifacts", () => {
  const artifact = compileRepositoryContextArtifact(
    minimalArtifactInput({
      activeClaims: [
        {
          claimId: "claim-1",
          claimType: "repository_source_excerpt_exists",
          claimText: "Exact excerpt exists in scoped source only.",
          scopeHash: "e".repeat(64),
          sourceRefs: ["src/billing.ts"],
          proofRefs: ["proof:1"],
          proofHashes: ["f".repeat(64)]
        }
      ],
      taskRetrieval: {
        selectedSourceRefs: ["src/billing.ts"],
        rankedSourceRefs: ["src/billing.ts"],
        semanticCandidates: [
          {
            candidateType: "semantic_candidate",
            sourceRef: "src/billing.ts",
            score: 8,
            matchedSignals: ["symbol:calculateDiscount:calculatediscount"],
            advisoryLabel: SEMANTIC_CANDIDATE_ADVISORY_LABEL
          }
        ],
        explicitSourceRefs: ["src/billing.ts"],
        testSourceRefs: [],
        relatedTestSourceRefs: [],
        relatedTestRelationships: [],
        graphSourceRefs: [],
        symbolSourceRefs: ["src/billing.ts"],
        lexicalSourceRefs: [],
        queryTerms: ["calculatediscount"],
        warnings: []
      }
    })
  );

  const activeClaims = artifact.sections.find((section) => section.id === "current-valid-claims");
  assert.equal(activeClaims?.body.includes("semantic_candidate"), false);
  assert.equal(
    artifact.dependencyManifest.dependencies.some((dependency) => dependency.kind === "semantic_candidate"),
    false
  );
  assert.equal(
    artifact.input.activeClaims?.some((claim) => claim.claimType === "semantic_candidate") ?? false,
    false
  );
});

function minimalArtifactInput(overrides = {}) {
  return {
    projectId: "project-1",
    sessionId: "session-1",
    taskId: "task-1",
    taskType: "bug_fix",
    riskOverlays: [],
    userRequestHash: "a".repeat(64),
    snapshot: {
      snapshotId: "snapshot-1",
      repoId: "repo-1",
      branch: "main",
      commit: "commit-1",
      worktreeStatus: "clean",
      worktreeHash: "c".repeat(64),
      snapshotHash: "b".repeat(64),
      dirtyPaths: []
    },
    worktreeStateId: "worktree-1",
    sources: [
      {
        sourceId: "source-billing",
        sourceRef: "src/billing.ts",
        sourceType: "repository_file",
        sourceHash: "d".repeat(64),
        sourceScope: "committed",
        trustClass: "trusted",
        privacyStatus: "allowed",
        redactionStatus: "not_needed"
      }
    ],
    sourceExcerpts: [],
    symbolNodes: [],
    symbolEdges: [],
    createdAt: "2026-06-08T00:00:00.000Z",
    ...overrides
  };
}

function source(sourceId, sourceRef) {
  return {
    sourceId,
    sourceRef,
    sourceType: "repository_file"
  };
}

function symbol(sourceId, pathValue, name) {
  return {
    sourceId,
    path: pathValue,
    name,
    symbolKind: "function",
    startLine: 1,
    endLine: 1
  };
}
