import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  createCompressionStorageRepositories,
  createEvidenceStorageRepositories,
  createIndexingStorageRepositories,
  createStorageRepositories
} from "../../.tmp/build/src/core/storage/index.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-cli-local-project-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    writeFileSync(path.join(dir, "README.md"), "# Fixture\n");
    execGit(dir, ["add", "README.md"]);
    execGit(dir, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "initial fixture"
    ]);
    fn(dir);
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

function switchToFeatureBranch(repoPath) {
  execGit(repoPath, ["checkout", "-b", "feature/context"]);
  writeFileSync(path.join(repoPath, "README.md"), "# Feature branch\n");
  execGit(repoPath, ["add", "README.md"]);
  execGit(repoPath, [
    "-c",
    "user.name=Grape Test",
    "-c",
    "user.email=grape@example.test",
    "commit",
    "-m",
    "feature branch change"
  ]);
}

function runCli(repoPath, args, cwd = repoPath) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8"
  });
}

function runCliJson(repoPath, args) {
  const result = runCli(repoPath, [...args, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("cli help exposes setup, status, doctor, and mcp guidance commands", () => {
  const result = spawnSync(process.execPath, [cliPath, "help"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /grape init --connect/);
  assert.match(result.stdout, /grape sync/);
  assert.match(result.stdout, /grape compile --task <text>/);
  assert.match(result.stdout, /grape diff-context --task <text>/);
  assert.match(result.stdout, /grape artifacts/);
  assert.match(result.stdout, /grape bench --fixture <name>/);
  assert.match(result.stdout, /grape sessions/);
  assert.match(result.stdout, /grape stale/);
  assert.match(result.stdout, /grape claims --active/);
  assert.match(result.stdout, /grape conflicts/);
  assert.match(result.stdout, /grape proofs/);
  assert.match(result.stdout, /grape status/);
  assert.match(result.stdout, /grape doctor/);
  assert.match(result.stdout, /grape doctor --privacy/);
  assert.match(result.stdout, /grape mcp --print-config/);
  assert.match(result.stdout, /grape mcp --stdio/);
});

test("cli init --connect bootstraps local .grape state and keeps it out of git status", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, "binary.dat"), Buffer.from([0, 1, 2, 3]));
    execGit(repoPath, ["add", "binary.dat"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add binary scan diagnostic"
    ]);

    const init = runCli(repoPath, ["init", "--connect"]);

    assert.equal(init.status, 0, init.stderr);
    assert.equal(init.stderr, "");
    assert.match(init.stdout, /Grape initialized/);
    assert.match(init.stdout, /Scan diagnostics:/);
    assert.match(init.stdout, /Rejection reasons: binary=1/);
    assert.equal(existsSync(path.join(repoPath, ".grape", "config.json")), true);
    assert.equal(existsSync(path.join(repoPath, ".grape", "grape.db")), true);
    assert.match(readFileSync(path.join(repoPath, ".git", "info", "exclude"), "utf8"), /\.grape\//);
    assert.equal(execGit(repoPath, ["status", "--porcelain=v1"]), "");
    assert.deepEqual(localSourceRejectionRefs(repoPath).filter((sourceRef) => sourceRef.startsWith(".grape/")), []);
    assert.deepEqual(localIndexedPaths(repoPath).filter((sourceRef) => sourceRef.startsWith(".grape/")), []);

    const status = runCliJson(repoPath, ["status"]);
    assert.equal(status.initialized, true);
    assert.equal(status.databaseExists, true);
    assert.deepEqual(status.pendingMigrations, []);
    assert.equal(status.dirtyWorktree, false);
    assert.equal(status.scan.rejectedFileCount, 1);
    assert.equal(status.scan.rejectionReasonCounts.binary, 1);
    assert.deepEqual(status.recoveryGuidance, []);

    const doctor = runCliJson(repoPath, ["doctor"]);
    assert.equal(doctor.overallStatus, "pass");
    assert.deepEqual(doctor.recoveryGuidance, []);
    assert.ok(doctor.checks.some((check) => check.id === "privacy_local_exclude" && check.status === "pass"));

    mkdirSync(path.join(repoPath, "src"));
    const subdirStatus = runCli(repoPath, ["status", "--json"], path.join(repoPath, "src"));
    assert.equal(subdirStatus.status, 0, subdirStatus.stderr);
    assert.equal(subdirStatus.stderr, "");
    assert.equal(JSON.parse(subdirStatus.stdout).initialized, true);
  });
});

test("cli init --connect reports bootstrap project detection without durable rule promotion", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "src"));
    writeFileSync(path.join(repoPath, "src", "main.ts"), "export const main = () => 'ok';\n");
    writeFileSync(path.join(repoPath, "tsconfig.json"), "{\"compilerOptions\":{\"strict\":true}}\n");
    writeFileSync(path.join(repoPath, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(
      path.join(repoPath, "package.json"),
      `${JSON.stringify(
        {
          scripts: {
            dev: "next dev",
            build: "next build",
            test: "vitest run",
            lint: "next lint"
          },
          dependencies: {
            next: "^15.0.0",
            react: "^19.0.0"
          },
          devDependencies: {
            typescript: "^5.0.0",
            vitest: "^3.0.0"
          }
        },
        null,
        2
      )}\n`
    );
    execGit(repoPath, ["add", "package.json", "pnpm-lock.yaml", "src/main.ts", "tsconfig.json"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add package metadata"
    ]);

    const init = runCli(repoPath, ["init", "--connect"]);
    assert.equal(init.status, 0, init.stderr);
    assert.match(init.stdout, /Bootstrap detection/);
    assert.match(init.stdout, /Languages: TypeScript, JavaScript/);
    assert.match(init.stdout, /Frameworks: Next\.js, React, Vitest/);
    assert.match(init.stdout, /Package manager: pnpm/);
    assert.match(init.stdout, /Test command: pnpm test/);
    assert.match(init.stdout, /Candidate rules \(not durable\)/);

    const initJson = runCliJson(repoPath, ["init", "--connect"]);
    assert.equal(initJson.bootstrap.packageManager, "pnpm");
    assert.deepEqual(initJson.bootstrap.languages, ["TypeScript", "JavaScript"]);
    assert.ok(initJson.bootstrap.frameworks.includes("Next.js"));
    assert.ok(initJson.bootstrap.frameworks.includes("Vitest"));
    assert.ok(initJson.bootstrap.scripts.includes("test"));
    assert.ok(initJson.bootstrap.commands.includes("pnpm test"));
    assert.equal(initJson.bootstrap.testCommand, "pnpm test");
    assert.ok(initJson.bootstrap.entryPoints.includes("src/main.ts"));
    assert.ok(initJson.bootstrap.configFiles.includes("package.json"));
    assert.ok(
      initJson.bootstrap.candidateRules.some((rule) =>
        rule.includes("Run pnpm test before final changes")
      )
    );
  });
});

test("cli status and doctor provide recovery guidance before bootstrap", () => {
  withGitRepo((repoPath) => {
    const status = runCli(repoPath, ["status", "--json"]);
    assert.equal(status.status, 0, status.stderr);
    const parsedStatus = JSON.parse(status.stdout);
    assert.equal(parsedStatus.initialized, false);
    assert.ok(
      parsedStatus.recoveryGuidance.includes(
        "Run grape init --connect from the repository root to bootstrap or repair local state."
      )
    );

    const doctor = runCli(repoPath, ["doctor", "--json"]);
    assert.equal(doctor.status, 3, doctor.stderr);
    const parsedDoctor = JSON.parse(doctor.stdout);
    assert.equal(parsedDoctor.overallStatus, "fail");
    assert.ok(
      parsedDoctor.recoveryGuidance.includes(
        "Run grape init --connect from the repository root to bootstrap or repair local state."
      )
    );
  });
});

test("cli compile auto-bootstraps and writes inspectable context artifact files", () => {
  withGitRepo((repoPath) => {
    writeFileSync(path.join(repoPath, "AGENTS.md"), "Prefer focused tests for changed behavior.\n");
    execGit(repoPath, ["add", "AGENTS.md"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add project rules"
    ]);

    const first = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "session-test"
    ]);

    assert.equal(existsSync(path.join(repoPath, ".grape", "config.json")), true);
    assert.equal(existsSync(path.join(repoPath, ".grape", "grape.db")), true);
    assert.equal(existsSync(first.artifactJsonPath), true);
    assert.equal(existsSync(first.artifactMarkdownPath), true);
    assert.equal(first.sessionId, "session-test");
    assert.equal(first.contextPackItems.some((item) => item.state === "NEW"), true);
    const firstPackItem = first.contextPackItems[0];
    assert.equal(typeof firstPackItem.id, "string");
    assert.equal(typeof firstPackItem.itemKind, "string");
    assert.equal(typeof firstPackItem.itemRef, "string");
    assert.equal(typeof firstPackItem.content, "string");
    assert.equal(typeof firstPackItem.tokenCount, "number");
    assert.equal(Array.isArray(firstPackItem.inputRefs), true);
    assert.equal(
      first.contextPackItems.flatMap((item) => item.inputRefs).some((ref) => ref.kind === "source_file"),
      false
    );
    assert.equal("body" in firstPackItem, false);
    const artifactMarkdown = readFileSync(first.artifactMarkdownPath, "utf8");
    assert.match(artifactMarkdown, /# Grape Context Pack/);
    assert.match(artifactMarkdown, /## Artifact Summary/);
    assert.match(artifactMarkdown, /Artifact format: grape\.context-pack\.v1/);
    assert.match(artifactMarkdown, /Compile mode:/);
    assert.match(artifactMarkdown, /## Diff Summary/);
    assert.match(artifactMarkdown, /## Omitted And Restore/);
    assert.match(artifactMarkdown, /## Artifact Sections/);
    assert.match(artifactMarkdown, /## Warnings And Safety/);
    assert.match(artifactMarkdown, /Input refs:/);
    assert.match(artifactMarkdown, /Active Project Rules/);
    assert.match(artifactMarkdown, /Prefer focused tests/);
    assert.match(artifactMarkdown, /Exact Source Evidence/);
    assert.match(artifactMarkdown, /Proof: proof:/);

    const artifactJson = JSON.parse(readFileSync(first.artifactJsonPath, "utf8"));
    const scaffoldJsonPath = first.artifactJsonPath.replace(/\.json$/, ".scaffold.json");
    assert.equal(artifactJson.contextPackItemShape, "ContextPackItem");
    assert.equal(artifactJson.artifactFormat, "grape.context-pack.v1");
    assert.equal(artifactJson.contextArtifact.id, first.artifactId);
    assert.equal(artifactJson.contextArtifact.artifactFormatVersion, 1);
    assert.equal(artifactJson.contextArtifact.repoSnapshotId.length > 0, true);
    assert.equal(
      artifactJson.contextArtifact.outputSections.some((section) => section.type === "code_span"),
      true
    );
    assert.equal("artifact" in artifactJson, false);
    assert.equal(artifactJson.contextPackItems.length, first.contextPackItems.length);
    assert.equal(
      artifactJson.contextArtifact.outputSections.some(
        (section) =>
          section.id === "exact-source-evidence" &&
          section.itemRefs.some((ref) => ref.kind === "proof")
      ),
      true
    );
    assert.equal(
      artifactJson.contextArtifact.outputSections.some(
        (section) =>
          section.id === "active-project-rules" &&
          section.pinned &&
          section.itemRefs.some((ref) => ref.kind === "proof")
      ),
      true
    );
    const currentValidClaims = artifactJson.contextArtifact.outputSections.find(
      (section) => section.id === "current-valid-claims"
    );
    assert.equal(currentValidClaims?.type, "claim");
    assert.equal(currentValidClaims?.requiresExactCode, true);
    assert.equal(currentValidClaims?.itemRefs.some((ref) => ref.kind === "claim"), true);
    assert.equal(currentValidClaims?.itemRefs.some((ref) => ref.kind === "proof"), true);
    assert.equal(first.contextPackItems.some((item) => item.itemKind === "claim"), true);
    const compressionOrientation = artifactJson.contextArtifact.outputSections.find(
      (section) => section.id === "compression-orientation"
    );
    assert.equal(compressionOrientation?.type, "compression_summary");
    assert.equal(compressionOrientation?.requiresExactCode, false);
    assert.equal(compressionOrientation?.itemRefs.some((ref) => ref.kind === "compression_artifact"), true);
    assert.equal(artifactJson.contextArtifact.compressionArtifactRefs.length > 0, true);
    assert.equal(first.contextPackItems.some((item) => item.itemKind === "compression_artifact"), true);
    assert.equal(existsSync(scaffoldJsonPath), true);
    const scaffoldJson = JSON.parse(readFileSync(scaffoldJsonPath, "utf8"));
    assert.equal(scaffoldJson.artifact.artifactId, first.artifactId);
    assert.equal(localContextArtifactCount(repoPath), 1);
    assert.equal(localProofCount(repoPath) > 0, true);
    assert.equal(localClaimCount(repoPath) > 0, true);
    assert.equal(localCompressionArtifactCount(repoPath) > 0, true);
    assert.deepEqual(localCompressionArtifactTypes(repoPath), [
      "context_pack_summary",
      "rule_digest",
      "symbol_outline"
    ]);
    const sessions = runCliJson(repoPath, ["sessions"]);
    assert.equal(sessions.sessions.length, 1);
    assert.equal(sessions.sessions[0].sessionId, "session-test");
    assert.equal(sessions.sessions[0].artifactCount, 1);
    assert.equal(sessions.sessions[0].sentItemCount > 0, true);
    assert.equal(sessions.sessions[0].packItemCount > 0, true);
    const stale = runCliJson(repoPath, ["stale"]);
    assert.equal(stale.inspectedSessionCount, 1);
    assert.equal(stale.staleItems.length, 0);
    const claims = runCliJson(repoPath, ["claims", "--active"]);
    assert.equal(claims.claims.length > 0, true);
    assert.equal(claims.claims[0].claimType, "repository_source_excerpt_exists");
    assert.equal(claims.claims[0].verificationStatus, "verified");
    assert.equal(claims.claims[0].proofRefs.length > 0, true);
    const conflicts = runCliJson(repoPath, ["conflicts"]);
    assert.equal(conflicts.conflicts.length, 0);
    assert.deepEqual(conflicts.warnings, []);
    const proofs = runCliJson(repoPath, ["proofs"]);
    assert.equal(proofs.proofs.length > 0, true);
    const proof = proofs.proofs[0];
    assert.equal(proof.supportStatus, "direct");
    assert.equal(proof.proofType, "exact_source_excerpt");
    assert.equal("excerpt" in proof, false);
    assert.equal("body" in proof, false);
    const proofDetail = runCliJson(repoPath, ["proofs", "--proof", proof.proofId]);
    assert.equal(proofDetail.proofs.length, 1);
    assert.equal(proofDetail.proofs[0].proofId, proof.proofId);
    const sourceProofs = runCliJson(repoPath, ["proofs", "--source", proof.sourceId]);
    assert.equal(sourceProofs.proofs.every((sourceProof) => sourceProof.sourceId === proof.sourceId), true);

    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "session-test"
    ]);

    assert.equal(second.sessionId, "session-test");
    assert.equal(second.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE"), true);
    assert.equal(localContextArtifactCount(repoPath), 2);
    assert.deepEqual(localCompressionArtifactTypes(repoPath), [
      "context_pack_summary",
      "rule_digest",
      "symbol_outline"
    ]);
    const secondArtifactJson = JSON.parse(readFileSync(second.artifactJsonPath, "utf8"));
    const secondCompressionOrientation = secondArtifactJson.contextArtifact.outputSections.find(
      (section) => section.id === "compression-orientation"
    );
    assert.match(secondCompressionOrientation?.text ?? "", /Type: context_pack_summary/);
    assert.match(secondCompressionOrientation?.text ?? "", /Prior sent items:/);
    assert.equal(
      secondArtifactJson.contextArtifact.compressionArtifactRefs.some((ref) =>
        ref.startsWith("compression:context_pack_summary:")
      ),
      true
    );

    const restoreToken = second.contextPackItems.find((item) => item.state === "RESTORE_AVAILABLE").restoreId;
    const omitted = runCliJson(repoPath, ["omitted", "--session", "session-test"]);
    assert.equal(omitted.omittedItems.some((item) => item.restoreId === restoreToken), true);

    const restored = runCliJson(repoPath, ["omitted", "--session", "session-test", "--token", restoreToken]);
    assert.equal(restored.status, "restored");
    assert.equal(restored.sectionId, "task");
    assert.match(restored.body, /Task type/);

    const artifactList = runCliJson(repoPath, ["artifacts", "--session", "session-test"]);
    assert.equal(artifactList.artifacts.length, 2);
    assert.equal(artifactList.artifacts.some((artifact) => artifact.artifactId === second.artifactId), true);

    const artifactDetail = runCliJson(repoPath, ["artifacts", "--artifact", second.artifactId]);
    assert.equal(artifactDetail.artifactId, second.artifactId);
    assert.equal(typeof artifactDetail.rootPath, "string");
    assert.equal(artifactDetail.dependencies.length > 0, true);
    assert.match(artifactDetail.artifactFiles.json, /^\.grape\//);
    assert.equal(path.isAbsolute(artifactDetail.artifactFiles.json), false);

    const reset = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "session-test",
      "--reset-session"
    ]);

    assert.equal(reset.sessionId, "session-test");
    assert.match(reset.sessionResetId, /^reset:/);
    assert.equal(reset.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
    assert.equal(reset.contextPackItems.some((item) => item.state === "NEW"), true);
    assert.equal(reset.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
    assert.equal(localContextArtifactCount(repoPath), 3);
  });
});

test("cli compile uses task retrieval to prioritize matching exact source evidence", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "src"));
    for (let index = 0; index < 6; index += 1) {
      writeFileSync(path.join(repoPath, "src", `a-${index}.ts`), `export const filler${index} = true;\n`);
    }
    writeFileSync(
      path.join(repoPath, "src", "z-billing.ts"),
      [
        "// billing refund invoice workflow",
        "export function refundInvoice() {",
        "  return 'refund issued';",
        "}",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "src"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add retrieval fixture"
    ]);

    const result = runCliJson(repoPath, [
      "compile",
      "--task",
      "Fix refundInvoice behavior",
      "--session",
      "retrieval-session"
    ]);
    const artifactJson = JSON.parse(readFileSync(result.artifactJsonPath, "utf8"));
    const retrievalSection = artifactJson.contextArtifact.outputSections.find((section) => section.id === "task-retrieval");
    const exactEvidence = artifactJson.contextArtifact.outputSections.find(
      (section) => section.id === "exact-source-evidence"
    );

    assert.equal(retrievalSection.itemRefs.some((ref) => ref.ref === "src/z-billing.ts"), true);
    assert.match(retrievalSection.text, /Lexical-matched refs:/);
    assert.match(exactEvidence.text, /Source: src\/z-billing\.ts/);
    assert.match(exactEvidence.text, /refundInvoice/);
    assert.equal(result.warnings.includes("task_retrieval_no_source_matches"), false);
  });
});

test("cli compile reports unsafe output when token budget cannot fit required context", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, [
      "compile",
      "--task",
      "Explain the repository",
      "--session",
      "budget-session",
      "--token-budget",
      "1",
      "--json"
    ]);

    assert.equal(result.status, 2, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.budget.status, "required_context_exceeds_budget");
    assert.ok(output.unsafeReasons.includes("token_budget_below_required_context"));
    assert.ok(output.recoveryGuidance.some((item) => item.includes("Increase --token-budget")));
  });
});

test("cli compile prunes optional context when token budget fits required context", () => {
  withGitRepo((repoPath) => {
    const baseline = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository",
      "--session",
      "budget-baseline-session"
    ]);
    const budget = baseline.budget.requiredContextTokens + 2;
    const result = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository",
      "--session",
      "budget-pruned-session",
      "--token-budget",
      String(budget)
    ]);
    const artifactJson = JSON.parse(readFileSync(result.artifactJsonPath, "utf8"));
    const omittedSectionIds = result.budget.omittedDueToBudget.map((item) => item.sectionId);
    const outputSectionIds = artifactJson.contextArtifact.outputSections.map((section) => section.id);
    const emittedSectionIds = result.contextPackItems.map((item) => item.sectionId);

    assert.equal(result.budget.status, "within_budget");
    assert.equal(result.warnings.includes("token_budget_pruned_optional_context"), true);
    assert.equal(result.unsafeReasons.includes("token_budget_below_required_context"), false);
    assert.equal(omittedSectionIds.length > 0, true);
    assert.equal(artifactJson.contextArtifact.omittedDueToBudget.length, omittedSectionIds.length);
    assert.equal(outputSectionIds.includes("task"), true);
    assert.equal(outputSectionIds.includes("repo-state"), true);
    for (const sectionId of omittedSectionIds) {
      assert.equal(typeof sectionId, "string");
      assert.equal(outputSectionIds.includes(sectionId), false);
      assert.equal(emittedSectionIds.includes(sectionId), false);
    }
  });
});

test("cli compile invalidates prior sent context when a session switches branches", () => {
  withGitRepo((repoPath) => {
    const first = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "branch-session"
    ]);

    switchToFeatureBranch(repoPath);

    const second = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "branch-session"
    ]);

    assert.equal(second.branch, "feature/context");
    assert.equal(second.sessionId, "branch-session");
    assert.equal(second.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "NEW"), true);
    assert.equal(second.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);

    const session = localContextSession(repoPath, "branch-session");
    assert.equal(session.branchName, "feature/context");
    assert.equal(session.headCommitSha, second.headCommit);
    const sessions = runCliJson(repoPath, ["sessions"]);
    const branchSession = sessions.sessions.find((candidate) => candidate.sessionId === "branch-session");
    assert.equal(branchSession?.branchName, "feature/context");
    assert.ok(["branch_changed", "durable_context_build"].includes(branchSession?.lastEventReason ?? ""));
    assert.equal(branchSession?.eventCount > 0, true);
    const stale = runCliJson(repoPath, ["stale", "--session", "branch-session"]);
    assert.equal(stale.inspectedSessionCount, 1);
    assert.equal(stale.staleItems.some((item) => item.staleReason === "branch_changed"), true);
    assert.equal(stale.staleItems.every((item) => item.invalidatesSentItemId.length > 0), true);
    assert.equal(stale.staleItems.every((item) => item.previousBranchName === "main"), true);

    const event = localSessionEvents(repoPath, "branch-session").find(
      (candidate) => candidate.eventType === "session_invalidated"
    );
    assert.ok(event);
    assert.equal(event.reason, "branch_changed");
    assert.deepEqual(JSON.parse(event.metadataJson), {
      reason: "branch_changed",
      previousBranch: "main",
      nextBranch: "feature/context",
      previousHeadCommit: first.headCommit,
      nextHeadCommit: second.headCommit
    });

    const third = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "branch-session"
    ]);

    assert.equal(third.branch, "feature/context");
    assert.equal(third.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), false);
    assert.equal(third.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), true);

    execGit(repoPath, ["checkout", "main"]);
    const backOnMain = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "branch-session"
    ]);

    assert.equal(backOnMain.branch, "main");
    assert.equal(backOnMain.contextPackItems.some((item) => item.state === "INVALIDATE_PREVIOUS"), true);
    assert.equal(backOnMain.contextPackItems.some((item) => item.state === "NEW"), true);
    assert.equal(backOnMain.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED"), false);
  });
});

test("cli compile marks risk overlays unsafe without task-selected exact spans", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, [
      "compile",
      "--task",
      "Review authentication changes",
      "--json"
    ]);

    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.riskOverlays, ["auth"]);
    assert.deepEqual(parsed.unsafeReasons, ["risk_overlay_missing_exact_context"]);
    assert.ok(parsed.warnings.includes("risk_overlay_requires_exact_context"));
    assert.ok(parsed.recoveryGuidance.some((item) => item.includes("exact file or symbol")));
  });
});

test("cli compile accepts risk overlays when task-selected exact spans exist", () => {
  withGitRepo((repoPath) => {
    mkdirSync(path.join(repoPath, "src"), { recursive: true });
    writeFileSync(
      path.join(repoPath, "src", "auth.ts"),
      [
        "export function requireSession(sessionId: string | undefined) {",
        "  if (!sessionId) return { status: 401 };",
        "  return { status: 200 };",
        "}",
        ""
      ].join("\n")
    );
    execGit(repoPath, ["add", "src/auth.ts"]);
    execGit(repoPath, [
      "-c",
      "user.name=Grape Test",
      "-c",
      "user.email=grape@example.test",
      "commit",
      "-m",
      "add auth fixture"
    ]);

    const result = runCli(repoPath, [
      "compile",
      "--task",
      "Review authentication session handling in src/auth.ts",
      "--json"
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.riskOverlays, ["auth"]);
    assert.deepEqual(parsed.unsafeReasons, []);
    const exactEvidence = parsed.contextArtifact.outputSections.find((section) => section.id === "exact-source-evidence");
    assert.ok(exactEvidence.itemRefs.some((ref) => ref.ref === "src/auth.ts"));
    assert.equal(exactEvidence.requiresExactCode, true);
  });
});

test("cli omitted rejects stale restore tokens after repository changes", () => {
  withGitRepo((repoPath) => {
    const { restoreToken } = createRestorableOmission(repoPath, "stale-restore-session");

    writeFileSync(path.join(repoPath, "README.md"), "# Fixture changed\n");
    const restore = runCli(repoPath, [
      "omitted",
      "--session",
      "stale-restore-session",
      "--token",
      restoreToken,
      "--json"
    ]);

    assert.equal(restore.status, 3, restore.stderr);
    const parsed = JSON.parse(restore.stdout);
    assert.equal(parsed.status, "stale");
    assert.ok(parsed.warnings.includes("restore_token_rejects_stale_dependency"));
  });
});

test("cli omitted rejects restore tokens when proof dependencies changed", () => {
  withGitRepo((repoPath) => {
    const { artifactScaffoldJsonPath, restoreToken } = createRestorableOmission(
      repoPath,
      "stale-proof-restore-session",
      "exact-source-evidence"
    );
    const proofId = proofIdForSection(artifactScaffoldJsonPath, "exact-source-evidence");
    tamperProofExcerptHash(repoPath, proofId);

    const restore = runCli(repoPath, [
      "omitted",
      "--session",
      "stale-proof-restore-session",
      "--token",
      restoreToken,
      "--json"
    ]);

    assert.equal(restore.status, 3, restore.stderr);
    const parsed = JSON.parse(restore.stdout);
    assert.equal(parsed.status, "stale");
    assert.equal(parsed.reason, `proof_hash_changed:${proofId}`);
    assert.ok(parsed.warnings.includes("restore_token_rejects_stale_dependency"));
  });
});

test("cli omitted rejects tampered artifact body before restoring context", () => {
  withGitRepo((repoPath) => {
    const { artifactScaffoldJsonPath, restoreToken } = createRestorableOmission(repoPath, "tamper-restore-session");
    updateArtifactJson(artifactScaffoldJsonPath, (artifactPack) => {
      artifactPack.artifact.sections.find((section) => section.id === "task").body = "Task type: tampered";
    });

    const restore = runCli(repoPath, [
      "omitted",
      "--session",
      "tamper-restore-session",
      "--token",
      restoreToken,
      "--json"
    ]);

    assert.equal(restore.status, 4);
    assert.equal(restore.stdout, "");
    assert.match(restore.stderr, /content hash does not match actual body/);
    assert.doesNotMatch(restore.stderr, /Task type: tampered/);
  });
});

test("cli omitted rejects blocked-redaction artifact sections before restoring context", () => {
  withGitRepo((repoPath) => {
    const { artifactScaffoldJsonPath, restoreToken } = createRestorableOmission(repoPath, "redaction-restore-session");
    updateArtifactJson(artifactScaffoldJsonPath, (artifactPack) => {
      artifactPack.artifact.sections.find((section) => section.id === "task").redactionStatus = "blocked";
    });

    const restore = runCli(repoPath, [
      "omitted",
      "--session",
      "redaction-restore-session",
      "--token",
      restoreToken,
      "--json"
    ]);

    assert.equal(restore.status, 4);
    assert.equal(restore.stdout, "");
    assert.match(restore.stderr, /blocked redaction status/);
    assert.match(restore.stderr, /Recovery:/);
    assert.match(restore.stderr, /\.grapeignore/);
  });
});

test("cli compile reports contended session locks", () => {
  withGitRepo((repoPath) => {
    const first = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "session-test"
    ]);
    setContextSessionLocked(repoPath, first.sessionId);

    const second = runCli(repoPath, [
      "compile",
      "--task",
      "Explain the repository entry points",
      "--session",
      "session-test"
    ]);

    assert.equal(second.status, 5);
    assert.match(second.stderr, /context session is locked/);
    assert.match(second.stderr, /Recovery:/);
    assert.match(second.stderr, /grape sessions/);
  });
});

function localSourceRejectionRefs(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return createEvidenceStorageRepositories(database).sourceRejections.listAll().map((row) => row.sourceRef);
  } finally {
    database.close();
  }
}

function localIndexedPaths(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    const rows = database
      .prepare("SELECT snapshot_id FROM repo_snapshots ORDER BY created_at DESC LIMIT 1")
      .all();
    const snapshotId = rows[0]?.snapshot_id;
    if (!snapshotId) return [];
    return createIndexingStorageRepositories(database).symbolNodes.listBySnapshot(String(snapshotId)).map((row) => row.path);
  } finally {
    database.close();
  }
}

function localContextArtifactCount(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return Number(database.prepare("SELECT count(*) AS count FROM context_artifacts").get().count);
  } finally {
    database.close();
  }
}

function localProofCount(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return Number(database.prepare("SELECT count(*) AS count FROM proofs").get().count);
  } finally {
    database.close();
  }
}

function localClaimCount(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return Number(database.prepare("SELECT count(*) AS count FROM claims").get().count);
  } finally {
    database.close();
  }
}

function localCompressionArtifactCount(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return createCompressionStorageRepositories(database).compressionArtifacts.listBySnapshot(
      String(database.prepare("SELECT snapshot_id FROM repo_snapshots ORDER BY created_at DESC LIMIT 1").get().snapshot_id)
    ).length;
  } finally {
    database.close();
  }
}

function localCompressionArtifactTypes(repoPath) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    const latestSnapshot = database.prepare("SELECT snapshot_id FROM repo_snapshots ORDER BY created_at DESC LIMIT 1").get();
    return [...new Set(createCompressionStorageRepositories(database).compressionArtifacts
      .listBySnapshot(String(latestSnapshot.snapshot_id))
      .map((artifact) => artifact.artifactType))]
      .sort();
  } finally {
    database.close();
  }
}

function localContextSession(repoPath, sessionId) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    const session = createStorageRepositories(database).contextSessions.get(sessionId);
    assert.ok(session);
    return session;
  } finally {
    database.close();
  }
}

function localSessionEvents(repoPath, sessionId) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    return createStorageRepositories(database).sessionEvents.listBySession(sessionId);
  } finally {
    database.close();
  }
}

function createRestorableOmission(repoPath, sessionId, sectionId) {
  runCliJson(repoPath, [
    "compile",
    "--task",
    "Explain the repository entry points",
    "--session",
    sessionId
  ]);
  const second = runCliJson(repoPath, [
    "compile",
    "--task",
    "Explain the repository entry points",
    "--session",
    sessionId
  ]);
  const restoreToken = second.contextPackItems.find(
    (item) => item.state === "RESTORE_AVAILABLE" && (!sectionId || item.sectionId === sectionId)
  )?.restoreId;
  assert.ok(restoreToken);
  return {
    artifactJsonPath: second.artifactJsonPath,
    artifactScaffoldJsonPath: second.artifactJsonPath.replace(/\.json$/, ".scaffold.json"),
    restoreToken
  };
}

function proofIdForSection(artifactScaffoldJsonPath, sectionId) {
  const artifactPack = JSON.parse(readFileSync(artifactScaffoldJsonPath, "utf8"));
  const proofId = artifactPack.artifact.sections.find((section) => section.id === sectionId)?.proofRefs?.[0];
  assert.ok(proofId);
  return proofId;
}

function tamperProofExcerptHash(repoPath, proofId) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    const result = database
      .prepare("UPDATE proofs SET excerpt_hash = ? WHERE proof_id = ?")
      .run("0".repeat(64), proofId);
    assert.equal(result.changes, 1);
  } finally {
    database.close();
  }
}

function updateArtifactJson(artifactJsonPath, mutate) {
  const artifactPack = JSON.parse(readFileSync(artifactJsonPath, "utf8"));
  mutate(artifactPack);
  writeFileSync(artifactJsonPath, `${JSON.stringify(artifactPack, null, 2)}\n`);
}

function setContextSessionLocked(repoPath, sessionId) {
  const database = new DatabaseSync(path.join(repoPath, ".grape", "grape.db"));
  try {
    database
      .prepare("UPDATE context_sessions SET lock_status = 'locked', lock_token = 'other-lock' WHERE session_id = ?")
      .run(sessionId);
  } finally {
    database.close();
  }
}

test("cli mcp --print-config emits the V1 stdio connection contract", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["mcp", "--print-config", "--repo", repoPath]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.grapeMcp, {
      status: "implemented",
      implemented: true,
      serverName: "grape",
      command: "grape",
      args: ["mcp", "--stdio", "--repo", repoPath],
      cwd: repoPath,
      transport: "stdio",
      tools: [
        "grape_get_context",
        "grape_get_artifact",
        "grape_get_claims",
        "grape_get_proofs",
        "grape_get_rules",
        "grape_get_omitted_item",
        "grape_get_stale_items",
        "grape_get_conflicts",
        "grape_get_status",
        "grape_record_candidate",
        "grape_record_command_result",
        "grape_record_test_result",
        "grape_record_user_decision",
        "grape_request_user_confirmation"
      ],
      note: "Run grape mcp --stdio --repo <repo-root> to serve Grape context over MCP stdio."
    });
  });
});

test("cli rejects unsupported flags instead of pretending commands are implemented", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["doctor", "--export"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsupported option/);
  });
});

test("cli compile reports invalid task policy as usage errors", () => {
  withGitRepo((repoPath) => {
    const result = runCli(repoPath, ["compile", "--task", "Check risk", "--risk", "made_up_risk"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsupported risk overlay/);
  });
});

test("cli status reports config root mismatch as stale local state", () => {
  withGitRepo((repoPath) => {
    const init = runCli(repoPath, ["init", "--connect"]);
    assert.equal(init.status, 0, init.stderr);

    const configPath = path.join(repoPath, ".grape", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.project.rootPath = path.join(repoPath, "moved");
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const status = runCli(repoPath, ["status", "--json"]);
    assert.equal(status.status, 3, status.stderr);
    assert.equal(status.stderr, "");
    const parsed = JSON.parse(status.stdout);
    assert.equal(parsed.initialized, false);
    assert.ok(parsed.errors.includes("Grape config root path does not match the current repository path."));
    assert.ok(parsed.recoveryGuidance.some((item) => item.includes("--repo")));
  });
});
