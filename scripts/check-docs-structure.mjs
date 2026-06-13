import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const docsV1 = join(root, "docs", "v1");

const allowedV1RootFiles = new Set(["README.md", "SPEC.md"]);
const allowedV1RootDirs = new Set([
  "architecture",
  "core",
  "contracts",
  "interfaces",
  "quality",
  "planning",
  "decisions",
  "examples",
  "fixtures",
  "legacy"
]);

const stalePathPattern =
  /docs\/v1\/(ARCHITECTURE|STATE_MACHINE|INVARIANTS|TRUST_MODEL|CONTEXT_ARTIFACT|CONTEXT_DIFF|COMPRESSION|MCP_TOOLS|CLI|STORAGE|TESTING|BENCHMARKS|SECURITY|IMPLEMENTATION_PHASES|IMPLEMENTATION_LOG|SPEC_CHANGELOG|DECISIONS|EXAMPLES|FIXTURES)(\.md|\/)/;

const errors = [];

for (const entry of readdirSync(docsV1, { withFileTypes: true })) {
  if (entry.isFile() && !allowedV1RootFiles.has(entry.name)) {
    errors.push(`Unexpected docs/v1 root file: ${entry.name}`);
  }

  if (entry.isDirectory() && !allowedV1RootDirs.has(entry.name)) {
    errors.push(`Unexpected docs/v1 root directory: ${entry.name}`);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(path);
      continue;
    }

    if (!entry.isFile() || !path.endsWith(".md")) {
      continue;
    }

    const body = readFileSync(path, "utf8");
    if (stalePathPattern.test(body)) {
      errors.push(`Stale flat V1 docs path found in ${relative(root, path)}`);
    }
  }
}

walk(join(root, "docs"));

for (const path of [
  join(root, "docs", "README.md"),
  join(root, "docs", "v1", "README.md"),
  join(root, "docs", "v1", "SPEC.md")
]) {
  try {
    if (!statSync(path).isFile()) {
      errors.push(`Required docs file is not a file: ${relative(root, path)}`);
    }
  } catch {
    errors.push(`Missing required docs file: ${relative(root, path)}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("docs structure ok");
