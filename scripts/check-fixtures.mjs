import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const fixturesRoot = join(root, "tests", "fixtures");
const errors = [];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function requireArray(value, field, fixturePath) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${fixturePath}: ${field} must be a non-empty array`);
  }
}

function requireNonEmptyString(value, field, fixturePath) {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${fixturePath}: ${field} must be a non-empty string`);
  }
}

if (existsSync(fixturesRoot)) {
  for (const entry of readdirSync(fixturesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fixtureDir = join(fixturesRoot, entry.name);
    const metadataPath = join(fixtureDir, "grape-fixture.json");
    const fixtureLabel = relative(root, metadataPath);

    if (!existsSync(metadataPath)) {
      errors.push(`${relative(root, fixtureDir)}: missing grape-fixture.json`);
      continue;
    }

    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));

    if (metadata.name !== entry.name) {
      errors.push(`${fixtureLabel}: name must match fixture directory`);
    }

    requireArray(metadata.files, "files", fixtureLabel);
    requireArray(metadata.expectedClaims, "expectedClaims", fixtureLabel);
    requireArray(metadata.expectedArtifactSections, "expectedArtifactSections", fixtureLabel);
    requireArray(metadata.expectedFirstTurnDiffStates, "expectedFirstTurnDiffStates", fixtureLabel);
    requireArray(metadata.expectedSecondTurnDiffStates, "expectedSecondTurnDiffStates", fixtureLabel);
    requireNonEmptyString(metadata.benchmarkTask, "benchmarkTask", fixtureLabel);

    for (const file of metadata.files ?? []) {
      const filePath = join(fixtureDir, file.path);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        errors.push(`${fixtureLabel}: missing fixture file ${file.path}`);
        continue;
      }

      const actualHash = sha256(filePath);
      if (actualHash !== file.sha256) {
        errors.push(`${fixtureLabel}: hash mismatch for ${file.path}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("fixtures ok");
