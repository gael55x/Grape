import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src", "shared", "contracts.ts"), "utf8");

const expected = {
  taskTypes: [
    "general",
    "refactor",
    "feature",
    "bugfix",
    "test",
    "docs",
    "security",
    "auth",
    "permissions",
    "payments",
    "webhooks",
    "secrets",
    "crypto",
    "migration",
    "production_config"
  ],
  riskOverlays: [
    "security",
    "auth",
    "permissions",
    "payments",
    "webhooks",
    "secrets",
    "crypto",
    "migration",
    "production_config"
  ],
  diffStates: [
    "NEW",
    "CHANGED",
    "PINNED",
    "OMIT_UNCHANGED",
    "INVALIDATE_PREVIOUS",
    "RESTORE_AVAILABLE"
  ],
  sourceTypes: [
    "repo_file",
    "project_rule",
    "config_file",
    "test_result",
    "command_result",
    "user_confirmation",
    "agent_reported",
    "model_summarized"
  ],
  verificationStatuses: [
    "unverified",
    "partially_verified",
    "verified",
    "stale",
    "contradicted",
    "rejected"
  ],
  scopeMatchResults: ["match", "mismatch", "partial", "unknown"]
};

const errors = [];

function extractArray(name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) {
    errors.push(`Missing exported const array: ${name}`);
    return [];
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

for (const [name, values] of Object.entries(expected)) {
  const actual = extractArray(name);
  if (JSON.stringify(actual) !== JSON.stringify(values)) {
    errors.push(`${name} does not match canonical expected values`);
  }
}

if (source.includes("\"INVALIDATED\"")) {
  errors.push("DiffState must use INVALIDATE_PREVIOUS, not INVALIDATED");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("shared contracts ok");
