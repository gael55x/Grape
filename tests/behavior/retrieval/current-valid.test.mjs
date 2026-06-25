import assert from "node:assert/strict";
import test from "node:test";

import { resolveInMemoryCurrentValidCandidates } from "../../../.tmp/build/src/core/retrieval/index.js";

test("current-valid resolution activates candidates only after every gate passes", () => {
  const active = candidate({ id: "claim:active" });

  const result = resolveInMemoryCurrentValidCandidates([active]);

  assert.deepEqual(result.active.map((item) => item.id), ["claim:active"]);
  assert.deepEqual(result.rejected, []);
  assert.deepEqual(result.warnings, []);
});

test("current-valid resolution rejects on the first failing gate", () => {
  const result = resolveInMemoryCurrentValidCandidates([
    candidate({
      id: "claim:first-failure",
      verificationStatus: "unverified",
      proofRefs: [],
      sourceHashStatus: "mismatch"
    })
  ]);

  assert.deepEqual(result.active, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, "not_verified");
  assert.deepEqual(result.warnings, []);
});

test("current-valid resolution emits warnings for conservative unknown gates", () => {
  const cases = [
    {
      candidate: candidate({ id: "claim:hash-unknown", sourceHashStatus: "unknown" }),
      reason: "hash_unknown",
      warning: "Hash status is unknown, not current-valid: claim:hash-unknown"
    },
    {
      candidate: candidate({ id: "claim:dirty-unknown", dirtyScopeStatus: "unknown" }),
      reason: "dirty_scope_unknown",
      warning: "Dirty worktree scope is unknown, not current-valid: claim:dirty-unknown"
    },
    {
      candidate: candidate({ id: "claim:policy-blocked", claimPolicyStatus: "blocked" }),
      reason: "claim_policy_blocked",
      warning: "Durable claim policy blocked current-valid claim: claim:policy-blocked"
    },
    {
      candidate: candidate({ id: "claim:scope-partial", scopeResult: "partial" }),
      reason: "scope_partial",
      warning: "Partial scope is not current-valid: claim:scope-partial"
    },
    {
      candidate: candidate({ id: "claim:scope-unknown", scopeResult: "unknown" }),
      reason: "scope_unknown",
      warning: "Unknown scope is not current-valid: claim:scope-unknown"
    }
  ];

  const result = resolveInMemoryCurrentValidCandidates(cases.map((item) => item.candidate));

  assert.deepEqual(result.active, []);
  assert.deepEqual(
    result.rejected.map((item) => item.reason),
    cases.map((item) => item.reason)
  );
  assert.deepEqual(
    result.warnings,
    cases.map((item) => item.warning)
  );
});

test("current-valid resolution keeps an invalid runtime scope value out of active context", () => {
  const result = resolveInMemoryCurrentValidCandidates([
    candidate({ id: "claim:invalid-scope", scopeResult: "invalid" })
  ]);

  assert.deepEqual(result.active, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, "scope_invalid");
});

function candidate(overrides = {}) {
  return {
    id: "claim:default",
    text: "Claim text",
    sourceRefs: ["src/app.ts"],
    proofRefs: ["proof:1"],
    verificationStatus: "verified",
    scopeResult: "match",
    sourceHashStatus: "match",
    proofHashStatus: "match",
    contradictionStatus: "none",
    privacyStatus: "allowed",
    dirtyScopeStatus: "not_dirty",
    claimPolicyStatus: "allowed",
    ...overrides
  };
}
