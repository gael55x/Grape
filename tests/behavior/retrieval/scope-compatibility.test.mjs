import assert from "node:assert/strict";
import test from "node:test";

import {
  claimScopesCompatibleForSupersession,
  claimScopesOverlap,
  currentPackageRootFromSourceRefs,
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

test("package root helper derives only one explicit workspace root", () => {
  assert.equal(
    currentPackageRootFromSourceRefs([
      "packages/api/src/index.ts",
      "packages/api/src/index.test.ts"
    ]),
    "packages/api"
  );
  assert.equal(
    currentPackageRootFromSourceRefs([
      "packages/api/src/index.ts",
      "packages/web/src/index.ts"
    ]),
    undefined
  );
  assert.equal(currentPackageRootFromSourceRefs(["src/index.ts"]), undefined);
});

test("current package root rejects package-scoped claims from another package", () => {
  const apiClaim = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    sourceScope: "committed",
    packageRoot: "packages/api"
  }, {
    ...current,
    packageRoot: "packages/api"
  });
  const webClaim = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    sourceScope: "committed",
    packageRoot: "packages/web"
  }, {
    ...current,
    packageRoot: "packages/api"
  });

  assert.equal(apiClaim.scopeResult, "match");
  assert.equal(webClaim.scopeResult, "mismatch");
  assert.deepEqual(webClaim.mismatchedDimensions, ["packageRoot"]);
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

test("current session does not reject branch-scoped claims without session scope", () => {
  const resolved = resolveCurrentClaimScope({
    branch: "main",
    commit: "commit-a",
    sourceScope: "committed"
  }, {
    ...current,
    sessionId: "session-a"
  });

  assert.equal(resolved.scopeResult, "match");
  assert.equal(resolved.dirtyScopeStatus, "not_dirty");
});
