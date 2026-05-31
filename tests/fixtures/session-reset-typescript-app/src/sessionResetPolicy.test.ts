import assert from "node:assert/strict";
import test from "node:test";

import { planSessionReset } from "./sessionResetPolicy.js";

const baseState = {
  sessionId: "agent-context-review",
  taskKey: "explain-session-reset",
  repoStateHash: "repo-state-001",
  pinnedSafetyVersion: "rules-v1"
};

test("agent context loss forces a session reset and pinned safety resend", () => {
  const plan = planSessionReset({
    ...baseState,
    agentLostContext: true
  });

  assert.equal(plan.resetSession, true);
  assert.equal(plan.invalidatesPriorContext, true);
  assert.equal(plan.resendPinnedSafety, true);
  assert.equal(plan.restoreOmissions, false);
  assert.equal(plan.reason, "agent_lost_context");
});

test("continued context keeps omissions restorable without resetting", () => {
  const plan = planSessionReset({
    ...baseState,
    agentLostContext: false
  });

  assert.equal(plan.resetSession, false);
  assert.equal(plan.invalidatesPriorContext, false);
  assert.equal(plan.resendPinnedSafety, true);
  assert.equal(plan.restoreOmissions, true);
  assert.equal(plan.reason, "continue_existing_context");
});
