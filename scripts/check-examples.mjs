import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const examplesRoot = join(root, "docs", "v1", "examples");
const errors = [];

const compileModes = new Set([
  "safe_minimum",
  "partial_with_risk",
  "broad_context_required",
  "cannot_compile_safely"
]);
const contextInputKinds = new Set([
  "source",
  "claim",
  "proof",
  "file",
  "rule",
  "symbol",
  "test",
  "config",
  "lockfile",
  "compression_artifact",
  "repo_snapshot",
  "worktree_state",
  "session_ledger"
]);
const contextPackItemKinds = new Set([
  "claim",
  "proof",
  "code_span",
  "rule",
  "test_output",
  "symbol_summary",
  "compression_artifact",
  "open_question",
  "context_summary",
  "invalidation",
  "restore_hint"
]);
const contextSectionTypes = new Set([
  "task_summary",
  "repo_state",
  "rule",
  "claim",
  "proof",
  "code_span",
  "test",
  "config",
  "compression_summary",
  "symbol",
  "risk",
  "contradiction",
  "blind_spot",
  "open_question",
  "missing_context",
  "omitted_manifest",
  "diff_summary"
]);
const dependencyStrengths = new Set(["direct", "symbol", "test", "rule", "config", "compression", "weak_related"]);
const diffStates = new Set(["NEW", "CHANGED", "PINNED", "OMIT_UNCHANGED", "INVALIDATE_PREVIOUS", "RESTORE_AVAILABLE"]);
const riskOverlays = new Set([
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
const taskTypes = new Set(["bug_fix", "security_fix", "refactor", "migration", "feature", "test_repair", "analysis", "bootstrap"]);

const localPathPattern = /(^|[\s"'=:])(?:\/Users\/|\/home\/|\/private\/|\/var\/|\/Volumes\/|\/mnt\/|\/workspace\/|[A-Za-z]:\\)/;
const secretValuePattern =
  /\b(?:CURSOR_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|authorization|bearer|password|private_key)\b\s*[:=]\s*["']?[^"'\s<][^"'\s]*/i;

for (const entry of readdirSync(examplesRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

  const filePath = join(examplesRoot, entry.name);
  const label = relative(root, filePath);
  const value = readJson(filePath, label);
  if (!value) continue;

  validateNoPrivateOutput(value, label);
  validateContextArtifactExample(value, label);
  validateContextPackItems(value.contextPackItems, label);
  validateContextPackItems(value.contextArtifact?.contextPackItems, label);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("examples ok");

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function validateContextArtifactExample(value, label) {
  if (value.artifactFormat !== undefined && value.artifactFormat !== "grape.context-pack.v1") {
    errors.push(`${label}: artifactFormat must be grape.context-pack.v1`);
  }
  if (value.artifactFormatVersion !== undefined && value.artifactFormatVersion !== 1) {
    errors.push(`${label}: artifactFormatVersion must be 1`);
  }
  if (value.contextPackItemShape !== undefined && value.contextPackItemShape !== "ContextPackItem") {
    errors.push(`${label}: contextPackItemShape must be ContextPackItem`);
  }

  const artifact = value.contextArtifact;
  if (!artifact) return;

  requireMember(taskTypes, artifact.taskType, `${label}: contextArtifact.taskType`);
  requireMember(compileModes, artifact.compileMode, `${label}: contextArtifact.compileMode`);
  validateMembers(riskOverlays, artifact.riskOverlays, `${label}: contextArtifact.riskOverlays`);
  validateInputRefs(artifact.inputRefs, `${label}: contextArtifact.inputRefs`);
  validateSections(artifact.outputSections, `${label}: contextArtifact.outputSections`);
  validateDependencies(artifact.dependencyManifest?.dependencies, `${label}: contextArtifact.dependencyManifest.dependencies`);
}

function validateContextPackItems(items, label) {
  if (items === undefined) return;
  if (!Array.isArray(items)) {
    errors.push(`${label}: contextPackItems must be an array`);
    return;
  }

  for (const [index, item] of items.entries()) {
    requireMember(diffStates, item?.state, `${label}: contextPackItems[${index}].state`);
    requireMember(contextPackItemKinds, item?.itemKind, `${label}: contextPackItems[${index}].itemKind`);
    validateInputRefs(item?.inputRefs, `${label}: contextPackItems[${index}].inputRefs`);
  }
}

function validateInputRefs(inputRefs, label) {
  if (inputRefs === undefined) return;
  if (!Array.isArray(inputRefs)) {
    errors.push(`${label} must be an array`);
    return;
  }

  for (const [index, inputRef] of inputRefs.entries()) {
    requireMember(contextInputKinds, inputRef?.kind, `${label}[${index}].kind`);
    if (inputRef?.dependencyStrength !== undefined) {
      requireMember(dependencyStrengths, inputRef.dependencyStrength, `${label}[${index}].dependencyStrength`);
    }
  }
}

function validateSections(sections, label) {
  if (sections === undefined) return;
  if (!Array.isArray(sections)) {
    errors.push(`${label} must be an array`);
    return;
  }

  for (const [index, section] of sections.entries()) {
    requireMember(contextSectionTypes, section?.type, `${label}[${index}].type`);
    validateMembers(riskOverlays, section?.riskOverlays, `${label}[${index}].riskOverlays`);
    validateInputRefs(section?.itemRefs, `${label}[${index}].itemRefs`);
  }
}

function validateDependencies(dependencies, label) {
  if (dependencies === undefined) return;
  if (!Array.isArray(dependencies)) {
    errors.push(`${label} must be an array`);
    return;
  }

  for (const [index, dependency] of dependencies.entries()) {
    requireMember(contextInputKinds, dependency?.kind, `${label}[${index}].kind`);
    requireMember(dependencyStrengths, dependency?.strength, `${label}[${index}].strength`);
  }
}

function validateNoPrivateOutput(value, label) {
  walk(value, (path, item) => {
    if (typeof item !== "string") return;
    if (localPathPattern.test(item)) errors.push(`${label}: private local path-like value at ${path}`);
    if (secretValuePattern.test(item)) errors.push(`${label}: secret-like value at ${path}`);
  });
}

function requireMember(allowed, value, label) {
  if (typeof value !== "string" || !allowed.has(value)) {
    errors.push(`${label} has unsupported value ${JSON.stringify(value)}`);
  }
}

function validateMembers(allowed, values, label) {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    errors.push(`${label} must be an array`);
    return;
  }
  for (const [index, value] of values.entries()) {
    requireMember(allowed, value, `${label}[${index}]`);
  }
}

function walk(value, visit, path = "$") {
  visit(path, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    walk(item, visit, `${path}.${key}`);
  }
}
