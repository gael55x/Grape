import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "src", "core", "state", "state-machine.ts"),
  "utf8"
);
const compactSource = source.replace(/\s+/g, " ");

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
  ["context_artifact_compiled", "context_diff_generated", "generate_diff"],
  ["context_diff_generated", "context_pack_sent", "send_pack"]
];

const errors = [];

function extractConstArray(name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) {
    errors.push(`Missing exported const array: ${name}`);
    return [];
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

const states = new Set(extractConstArray("grapeStates"));
const events = new Set(extractConstArray("stateEvents"));

if (states.size < 20) {
  errors.push("Expected full V1 state list, not only alpha states");
}

for (const event of events) {
  if (!/^[a-z]+(_[a-z]+)*$/.test(event)) {
    errors.push(`State event must be snake_case: ${event}`);
  }
}

for (const [from, to, event] of requiredAlphaTransitions) {
  const transitionText = `from: "${from}", to: "${to}", event: "${event}"`;
  if (!compactSource.includes(transitionText)) {
    errors.push(`Missing alpha transition: ${from} -> ${to} via ${event}`);
  }

  if (!states.has(from)) {
    errors.push(`Transition references unknown from state: ${from}`);
  }

  if (!states.has(to)) {
    errors.push(`Transition references unknown to state: ${to}`);
  }

  if (!events.has(event)) {
    errors.push(`Transition references unknown event: ${event}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("state machine skeleton ok");
