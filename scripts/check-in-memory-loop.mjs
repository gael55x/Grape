import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function extractConstArray(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) {
    errors.push(`Missing exported const array: ${name}`);
    return [];
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function expectEqual(name, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${name} does not match expected values`);
  }
}

function checkSharedContracts() {
  const source = read("src/shared/contracts.ts");

  expectEqual("taskTypes", extractConstArray(source, "taskTypes"), [
    "bug_fix",
    "security_fix",
    "refactor",
    "migration",
    "feature",
    "test_repair",
    "analysis",
    "bootstrap"
  ]);

  expectEqual("riskOverlays", extractConstArray(source, "riskOverlays"), [
    "security",
    "auth",
    "permissions",
    "payments",
    "webhooks",
    "secrets",
    "crypto",
    "migration",
    "production_config"
  ]);

  expectEqual("diffStates", extractConstArray(source, "diffStates"), [
    "NEW",
    "CHANGED",
    "PINNED",
    "OMIT_UNCHANGED",
    "INVALIDATE_PREVIOUS",
    "RESTORE_AVAILABLE"
  ]);

  expectEqual("scopeMatchResults", extractConstArray(source, "scopeMatchResults"), [
    "match",
    "mismatch",
    "partial",
    "unknown"
  ]);

  expectEqual("sourceTypes", extractConstArray(source, "sourceTypes"), [
    "repository_file",
    "git_diff",
    "test_run",
    "command_run",
    "user_message",
    "tool_call",
    "runtime_log",
    "ci_job",
    "assistant_response",
    "manual_import",
    "rule_file",
    "config_file",
    "lockfile",
    "migration_file",
    "commit_message"
  ]);

  expectEqual("verificationStatuses", extractConstArray(source, "verificationStatuses"), [
    "verified",
    "partially_verified",
    "unverified",
    "refuted",
    "stale"
  ]);

  expectEqual("compressionArtifactTypes", extractConstArray(source, "compressionArtifactTypes"), [
    "symbol_outline",
    "rule_digest",
    "context_pack_summary",
    "decision_digest",
    "failure_timeline",
    "module_outline",
    "test_summary"
  ]);

  if (source.includes("\"INVALIDATED\"")) {
    errors.push("DiffState must use INVALIDATE_PREVIOUS, not INVALIDATED");
  }

  if (!source.includes("export type NonEmptyArray<T> = readonly [T, ...T[]];")) {
    errors.push("NonEmptyArray must live in shared contracts, not trust internals");
  }
}

function checkStateMachine() {
  const source = read("src/core/state/state-machine.ts");
  const compactSource = source.replace(/\s+/g, " ");
  const states = new Set(extractConstArray(source, "grapeStates"));
  const events = new Set(extractConstArray(source, "stateEvents"));
  const requiredAlphaTransitions = [
    ["uninitialized", "initialized", "init_project"],
    ["initialized", "repo_detected", "detect_repo"],
    ["repo_detected", "repo_snapshot_created", "create_snapshot"],
    ["repo_snapshot_created", "worktree_clean", "classify_worktree"],
    ["worktree_clean", "evidence_collected", "collect_evidence"],
    ["evidence_collected", "source_classified", "classify_source"],
    ["source_classified", "claim_candidate_created", "extract_claim_candidate"],
    ["claim_candidate_created", "proof_attached", "attach_proof"],
    ["proof_attached", "proof_validated", "validate_proof"],
    ["proof_validated", "durable_claim_persisted", "promote_claim"],
    ["durable_claim_persisted", "current_valid_context_resolved", "resolve_current_valid"],
    ["current_valid_context_resolved", "context_artifact_compiled", "compile_artifact"],
    ["context_artifact_compiled", "session_active", "activate_session"],
    ["session_active", "context_diff_generated", "generate_diff"],
    ["context_diff_generated", "context_pack_sent", "send_pack"]
  ];

  if (states.size < 20) {
    errors.push("Expected full V1 state list, not only alpha states");
  }

  for (const event of events) {
    if (!/^[a-z]+(_[a-z]+)*$/.test(event)) {
      errors.push(`State event must be snake_case: ${event}`);
    }
  }

  for (const [from, to, event] of requiredAlphaTransitions) {
    if (!compactSource.includes(`from: "${from}", to: "${to}", event: "${event}"`)) {
      errors.push(`Missing alpha transition: ${from} -> ${to} via ${event}`);
    }
  }
}

function checkTrustShapes() {
  const source = read("src/core/trust/claims.ts");

  for (const required of [
    "proofRefs: NonEmptyArray<string>;",
    'verificationStatus: Extract<VerificationStatus, "verified">;',
    'scopeResult: Extract<ScopeMatchResult, "match">;'
  ]) {
    if (!source.includes(required)) {
      errors.push(`Missing trust shape guard: ${required}`);
    }
  }

  if (source.includes("proofRefs?:")) {
    errors.push("DurableClaim proofRefs must not be optional");
  }
}

function checkCurrentValid() {
  const source = read("src/core/retrieval/current-valid.ts");

  for (const required of [
    "import type { ScopeMatchResult, VerificationStatus } from \"../../shared/index.js\";",
    "proofRefs: string[]",
    "resolveInMemoryCurrentValidCandidates",
    'candidate.verificationStatus !== "verified"',
    "candidate.proofRefs.length === 0",
    'candidate.sourceHashStatus === "mismatch"',
    'candidate.proofHashStatus === "mismatch"',
    'candidate.sourceHashStatus === "unknown" || candidate.proofHashStatus === "unknown"',
    'candidate.contradictionStatus === "active"',
    'candidate.privacyStatus === "blocked"',
    'candidate.dirtyScopeStatus === "mismatch"',
    'candidate.dirtyScopeStatus === "unknown"',
    'candidate.scopeResult === "match"',
    'candidate.scopeResult === "mismatch"',
    'candidate.scopeResult === "partial"',
    'candidate.scopeResult === "unknown"',
    'active.push(candidate)'
  ]) {
    if (!source.includes(required)) {
      errors.push(`Missing current-valid guard: ${required}`);
    }
  }

  if (source.includes(".sort(") || source.includes("rank")) {
    errors.push("Current-valid skeleton must not rank candidates");
  }
}

function checkRepoSnapshotShape() {
  const source = read("src/core/git/repo-snapshot.ts");

  for (const required of [
    "worktreeHash: string;",
    "createdAt: string;",
    "worktreeHash: input.worktreeHash",
    "createdAt: input.createdAt"
  ]) {
    if (!source.includes(required)) {
      errors.push(`Missing repo snapshot shape guard: ${required}`);
    }
  }

  if (source.includes('worktreeHash: ""') || source.includes('createdAt: ""')) {
    errors.push("RepoSnapshot shape must not create placeholder hashes or timestamps");
  }
}

function checkInMemoryArtifactShape() {
  const source = read("src/core/compiler/artifact/in-memory-context-artifact.ts");

  for (const required of [
    "dependencyManifest: InMemoryContextDependencyManifestShape;",
    "sections: InMemoryContextSectionShape[];",
    "assertInMemoryContextArtifactShape",
    "assertDependencyManifest(input.dependencyManifest)",
    "assertSections(input.sections, input.dependencyManifest)",
    'manifest.hashAlgorithm !== "sha256"',
    "manifest.dependencies.length === 0",
    "section.redactionStatus === \"blocked\"",
    "section.dependencyRefs.length === 0",
    "section.exactRequired && section.sourceRefs.length === 0",
    "section.exactRequired && section.type === \"active_claim\" && section.proofRefs.length === 0",
    "assertSha256Like(\"artifactHash\", input.artifactHash)",
    "assertSha256Like(\"section.contentHash\", section.contentHash)"
  ]) {
    if (!source.includes(required)) {
      errors.push(`Missing in-memory artifact shape guard: ${required}`);
    }
  }
}

function checkInMemoryDiffProof() {
  const source = read("src/core/diff/in-memory-context-diff.ts");

  for (const required of [
    "InMemoryContextDiffInput",
    "InMemoryContextDiffResult",
    "previous.sessionId === input.sessionId",
    'createPackItem(input, section, "PINNED", previous)',
    'createPackItem(input, section, "NEW")',
    'createPackItem(input, section, "CHANGED", previous)',
    '"OMIT_UNCHANGED"',
    '"RESTORE_AVAILABLE"',
    "safeOmissionReason: \"unchanged_restorable\"",
    "restoreToken",
    "unsafeOmissions",
    "omittedItems.push"
  ]) {
    if (!source.includes(required)) {
      errors.push(`Missing in-memory diff proof guard: ${required}`);
    }
  }
}

function checkInMemoryTokenAccounting() {
  const source = read("src/core/diff/in-memory-token-accounting.ts");

  for (const required of [
    "InMemoryTokenAccountingInput",
    "InMemoryTokenSavingsMetric",
    "calculateInMemoryTokenSavings",
    "naiveTokens",
    "grapeTokens",
    "omittedUnchangedTokens",
    "compressionSavedTokens: 0",
    "pinnedOverheadTokens",
    "invalidationOverheadTokens",
    "unsafeOmissions",
    "staleItemsSent",
    "reductionPercent",
    'item.state === "OMIT_UNCHANGED"',
    'item.state === "PINNED"',
    'item.state === "INVALIDATE_PREVIOUS"',
    "estimateTextTokens"
  ]) {
    if (!source.includes(required)) {
      errors.push(`Missing in-memory token accounting guard: ${required}`);
    }
  }
}

function checkAlphaSnapshot() {
  const fixtureDir = join(root, "tests", "fixtures", "clean-typescript-app");
  const metadata = JSON.parse(readFileSync(join(fixtureDir, "grape-fixture.json"), "utf8"));
  const stableInput = (metadata.files ?? [])
    .map((file) => `${file.path}:${file.sha256}`)
    .sort()
    .join("\n");
  const worktreeHash = createHash("sha256").update(stableInput).digest("hex");

  if (metadata.repoShape?.worktree !== "clean") {
    errors.push("clean-typescript-app snapshot must be clean");
  }

  if (!/^[a-f0-9]{64}$/.test(worktreeHash)) {
    errors.push("worktreeHash must be a sha256 hex digest");
  }

  if ((metadata.files ?? []).length < 4) {
    errors.push("snapshot must include source, test, rule, and package files");
  }
}

checkSharedContracts();
checkStateMachine();
checkTrustShapes();
checkCurrentValid();
checkRepoSnapshotShape();
checkInMemoryArtifactShape();
checkInMemoryDiffProof();
checkInMemoryTokenAccounting();
checkAlphaSnapshot();

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("in-memory context loop smoke checks ok");
