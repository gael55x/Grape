import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const behaviorRoot = join(repoRoot, "tests", "behavior");

function collectBehaviorTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectBehaviorTests(fullPath);
    }

    if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      return [fullPath];
    }

    return [];
  });
}

const testFiles = collectBehaviorTests(behaviorRoot)
  .sort((left, right) => left.localeCompare(right))
  .map((filePath) => relative(repoRoot, filePath));

if (testFiles.length === 0) {
  console.error("No behavior tests found under tests/behavior.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--no-warnings", "--test", "--test-concurrency=1", ...testFiles],
  { stdio: "inherit" },
);

process.exit(result.status ?? (result.signal ? 1 : 0));
