import assert from "node:assert/strict";
import test from "node:test";

import { recoveryGuidanceForCompileResult } from "../../../.tmp/build/src/app/local-project/setup/recovery.js";

test("compile recovery guidance explains omitted package group warnings", () => {
  const guidance = recoveryGuidanceForCompileResult({
    warnings: ["task_retrieval_package_groups_omitted_over_cap:1"],
    unsafeReasons: [],
    budget: budget()
  });

  assert.ok(guidance.some((item) => item.includes("package-scoped tasks")));
  assert.equal(guidance.some((item) => item.includes("--token-budget")), false);
});

test("compile recovery guidance explains omitted language group warnings", () => {
  const guidance = recoveryGuidanceForCompileResult({
    warnings: ["task_retrieval_language_groups_omitted_over_cap:1"],
    unsafeReasons: [],
    budget: budget()
  });

  assert.ok(guidance.some((item) => item.includes("language-scoped tasks")));
  assert.equal(guidance.some((item) => item.includes("--token-budget")), false);
});

test("compile recovery guidance distinguishes omitted seeded package warnings", () => {
  const guidance = recoveryGuidanceForCompileResult({
    warnings: [
      "task_retrieval_package_groups_omitted_over_cap:1",
      "task_retrieval_seed_packages_omitted_over_cap:1"
    ],
    unsafeReasons: [],
    budget: budget()
  });

  assert.ok(guidance.some((item) => item.includes("every seeded package")));
  assert.ok(guidance.some((item) => item.includes("package-scoped tasks")));
});

function budget(status = "within_budget") {
  return { status };
}
