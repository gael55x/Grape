import assert from "node:assert/strict";
import test from "node:test";

import {
  claimScopesCompatibleForSupersession,
  claimScopesOverlap,
  resolveCurrentClaimScope
} from "../../../.tmp/build/src/core/scope/index.js";

const current = {
  branch: "main",
  commit: "commit-a",
  worktreeHash: "worktree-a"
};

test("branch_invalid_claim_excluded", () => {
  const resolved = resolveCurrentClaimScope({
    branch: "feature/context",
    commit: "commit-a",
    sourceScope: "committed"
  }, current);

  assert.equal(resolved.scopeResult, "mismatch");
  assert.deepEqual(resolved.mismatchedDimensions, ["branch"]);
});

test("dirty_worktree_claim_not_branch_global", () => {
  const resolved = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    sourceScope: "unstaged",
    worktreeHash: "worktree-old"
  }, current);

  assert.equal(resolved.scopeResult, "match");
  assert.equal(resolved.dirtyScopeStatus, "mismatch");
});

test("current_valid_retrieval_respects_environment_scope", () => {
  const resolved = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    environment: "production",
    sourceScope: "committed"
  }, {
    ...current,
    environment: "staging"
  });

  assert.equal(resolved.scopeResult, "mismatch");
  assert.deepEqual(resolved.mismatchedDimensions, ["environment"]);
});

test("feature_flag_scope_prevents_false_global_claim", () => {
  const overlap = claimScopesOverlap(
    {
      branch: "main",
      commit: "commit-a",
      sourceRef: "src/flags.ts",
      sourceScope: "committed",
      featureFlags: { betaCheckout: true }
    },
    {
      branch: "main",
      commit: "commit-a",
      sourceRef: "src/flags.ts",
      sourceScope: "committed"
    }
  );

  assert.equal(overlap.status, "unknown");
  assert.deepEqual(overlap.unknownDimensions, ["featureFlags"]);
});

test("monorepo_package_boundary_prevents_same_source_supersession", () => {
  const overlap = claimScopesCompatibleForSupersession(
    {
      branch: "main",
      commit: "commit-a",
      sourceRef: "src/index.ts",
      sourceScope: "committed",
      packageRoot: "packages/api"
    },
    {
      branch: "main",
      commit: "commit-a",
      sourceRef: "src/index.ts",
      sourceScope: "committed",
      packageRoot: "packages/web"
    }
  );

  assert.equal(overlap.status, "disjoint");
  assert.deepEqual(overlap.mismatchedDimensions, ["packageRoot"]);
});

test("unknown_scope_overlap_warning", () => {
  const overlap = claimScopesOverlap(
    {
      commit: "commit-a",
      sourceRef: "src/a.ts",
      sourceScope: "committed"
    },
    {
      branch: "main",
      commit: "commit-a",
      sourceRef: "src/a.ts",
      sourceScope: "committed"
    }
  );

  assert.equal(overlap.status, "unknown");
  assert.deepEqual(overlap.unknownDimensions, ["branch"]);
});

test("session_scope_is_checked_only_when_current_session_is_known", () => {
  const broadInspection = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    sourceScope: "external",
    worktreeHash: "worktree-a",
    sessionId: "session-a"
  }, current);
  const scopedInspection = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    sourceScope: "external",
    worktreeHash: "worktree-a",
    sessionId: "session-a"
  }, {
    ...current,
    sessionId: "session-b"
  });

  assert.equal(broadInspection.scopeResult, "match");
  assert.equal(broadInspection.dirtyScopeStatus, "match");
  assert.equal(scopedInspection.scopeResult, "mismatch");
  assert.deepEqual(scopedInspection.mismatchedDimensions, ["sessionId"]);
});
