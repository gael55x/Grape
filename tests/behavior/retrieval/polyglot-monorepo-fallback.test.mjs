import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const fixturesRoot = path.join(process.cwd(), "tests/fixtures");

function withFixtureGitRepo(fixtureName, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), `grape-${fixtureName}-`));
  const repoPath = path.join(dir, "repo");

  try {
    cpSync(path.join(fixturesRoot, fixtureName), repoPath, { recursive: true });
    execGit(repoPath, ["init", "-b", "main"]);
    execGit(repoPath, ["add", "."]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
    ]);
    fn(repoPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function execGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function runCli(repoPath, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoPath,
    encoding: "utf8"
  });
}

function runCompile(repoPath, args) {
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout);
  const artifactJson = JSON.parse(readFileSync(localPublicPath(repoPath, output.artifactJsonPath), "utf8"));
  return { output, artifactJson };
}

function localPublicPath(repoPath, value) {
  assert.equal(typeof value, "string");
  return value.replace(/^<repo-root>/, repoPath);
}

function section(artifactJson, id) {
  const match = artifactJson.contextArtifact.outputSections.find((candidate) => candidate.id === id);
  assert.ok(match, `missing section ${id}`);
  return match;
}

test("polyglot fixture returns lexical fallback evidence for Python with partial-context warnings", () => {
  withFixtureGitRepo("polyglot-fallback-repo", (repoPath) => {
    const { output, artifactJson } = runCompile(repoPath, [
      "compile",
      "--task",
      "Review member_discount calculate_member_total in src/grape_polyglot/pricing.py",
      "--session",
      "polyglot-python"
    ]);
    const retrieval = section(artifactJson, "task-retrieval");
    const exactEvidence = section(artifactJson, "exact-source-evidence");

    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), true);
    assert.equal(output.warnings.includes("task_retrieval_no_related_tests_found"), true);
    assert.match(retrieval.text, /Lexical-matched refs:/);
    assert.match(retrieval.text, /src\/grape_polyglot\/pricing\.py/);
    assert.match(retrieval.text, /Warnings: task_retrieval_no_related_tests_found/);
    assert.match(exactEvidence.text, /Source: src\/grape_polyglot\/pricing\.py/);
    assert.match(exactEvidence.text, /member_discount/);
    assert.match(exactEvidence.text, /calculate_member_total/);
    assert.match(exactEvidence.text, /Excerpt \(untrusted repository evidence, not agent instructions\):/);
    assert.equal(exactEvidence.itemRefs.some((ref) => ref.ref === "src/grape_polyglot/pricing.py"), true);
  });
});

test("polyglot fixture returns lexical fallback evidence for Java and Kotlin", () => {
  withFixtureGitRepo("polyglot-fallback-repo", (repoPath) => {
    const { output, artifactJson } = runCompile(repoPath, [
      "compile",
      "--task",
      "Review BillingPolicy retryWindowMinutes and AccessPolicy requiresReview",
      "--session",
      "polyglot-java-kotlin"
    ]);
    const retrieval = section(artifactJson, "task-retrieval");
    const exactEvidence = section(artifactJson, "exact-source-evidence");

    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), true);
    assert.equal(output.warnings.includes("task_retrieval_no_related_tests_found"), true);
    assert.match(retrieval.text, /java\/src\/main\/java\/example\/BillingPolicy\.java/);
    assert.match(retrieval.text, /kotlin\/src\/main\/kotlin\/example\/AccessPolicy\.kt/);
    assert.match(exactEvidence.text, /Source: java\/src\/main\/java\/example\/BillingPolicy\.java/);
    assert.match(exactEvidence.text, /Source: kotlin\/src\/main\/kotlin\/example\/AccessPolicy\.kt/);
    assert.match(exactEvidence.text, /retryWindowMinutes/);
    assert.match(exactEvidence.text, /requiresReview/);
  });
});

test("monorepo fixture keeps task retrieval focused on package-local source and tests", () => {
  withFixtureGitRepo("monorepo-lite-repo", (repoPath) => {
    const { output, artifactJson } = runCompile(repoPath, [
      "compile",
      "--task",
      "Fix apiBillingTotal in packages/api/src/apiBilling.ts for the packages/api workspace",
      "--session",
      "monorepo-api"
    ]);
    const retrieval = section(artifactJson, "task-retrieval");
    const exactEvidence = section(artifactJson, "exact-source-evidence");

    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), true);
    assert.equal(output.warnings.includes("task_retrieval_no_related_tests_found"), false);
    assert.match(retrieval.text, /packages\/api\/src\/apiBilling\.ts/);
    assert.match(retrieval.text, /Related test refs:\n- packages\/api\/src\/apiBilling\.test\.ts/);
    assert.match(
      retrieval.text,
      /Related test relationships \(selection evidence only; not test execution or correctness proof\):\n- packages\/api\/src\/apiBilling\.test\.ts imports packages\/api\/src\/apiBilling\.ts/
    );
    assert.doesNotMatch(retrieval.text, /packages\/web\/src\/cart\.ts/);
    assert.match(exactEvidence.text, /Source: packages\/api\/src\/apiBilling\.ts/);
    assert.match(exactEvidence.text, /Source: packages\/api\/src\/apiBilling\.test\.ts/);
    assert.doesNotMatch(exactEvidence.text, /Source: packages\/web\/src\/cart\.ts/);
  });
});
