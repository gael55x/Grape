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

test("polyglot fixture returns exact fallback evidence for common service languages", () => {
  withFixtureGitRepo("polyglot-fallback-repo", (repoPath) => {
    const { output, artifactJson } = runCompile(repoPath, [
      "compile",
      "--task",
      [
        "Review fallback context in",
        "go/refund/refund.go",
        "rust/src/lib.rs",
        "dotnet/BillingLimit.cs",
        "ruby/lib/refund_policy.rb",
        "php/src/TaxPolicy.php"
      ].join(" "),
      "--session",
      "polyglot-service-languages"
    ]);
    const exactEvidence = section(artifactJson, "exact-source-evidence");
    const symbolSummary = section(artifactJson, "symbol-summary");
    const blindSpots = section(artifactJson, "index-blind-spots");

    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), true);
    assert.equal(output.warnings.includes("task_retrieval_no_related_tests_found"), true);
    assertExactEvidenceContains(exactEvidence, [
      ["go/refund/refund.go", "RefundHoldDays"],
      ["rust/src/lib.rs", "inventory_reserve_window_minutes"],
      ["dotnet/BillingLimit.cs", "ApprovalThresholdCents"],
      ["ruby/lib/refund_policy.rb", "expedited_refund?"],
      ["php/src/TaxPolicy.php", "vat_exemption_code"]
    ]);
    assert.match(symbolSummary.text, /go\/refund\/refund\.go :: go\/refund\/refund\.go \[go, module, high\]/);
    assert.match(symbolSummary.text, /dotnet\/BillingLimit\.cs :: dotnet\/BillingLimit\.cs \[csharp, module, high\]/);
    assert.match(
      blindSpots.text,
      /Generic text fallback selected languages: csharp, go, php, ruby, rust\./
    );
    assert.match(blindSpots.text, /It does not prove module edges, test edges, framework routes, types, or runtime behavior\./);
  });
});

test("polyglot fixture returns exact fallback evidence for Swift, native, shell, and docs", () => {
  withFixtureGitRepo("polyglot-fallback-repo", (repoPath) => {
    const { output, artifactJson } = runCompile(repoPath, [
      "compile",
      "--task",
      [
        "Review fallback context in",
        "swift/Sources/Checkout/AccessWindow.swift",
        "native/src/retry_budget.c",
        "native/src/audit_bridge.cpp",
        "scripts/deploy-check.sh",
        "docs/operations.md"
      ].join(" "),
      "--session",
      "polyglot-native-configs"
    ]);
    const exactEvidence = section(artifactJson, "exact-source-evidence");
    const blindSpots = section(artifactJson, "index-blind-spots");

    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), true);
    assert.equal(output.warnings.includes("task_retrieval_no_related_tests_found"), true);
    assertExactEvidenceContains(exactEvidence, [
      ["swift/Sources/Checkout/AccessWindow.swift", "staffOverrideHours"],
      ["native/src/retry_budget.c", "retry_budget_seconds"],
      ["native/src/audit_bridge.cpp", "audit_bridge_batch_size"],
      ["scripts/deploy-check.sh", "deploy_guard_mode"],
      ["docs/operations.md", "replay_window_hours"]
    ]);
    assert.match(blindSpots.text, /Generic text fallback selected languages: c, cpp, shell, swift\./);
    assert.doesNotMatch(blindSpots.text, /markdown/);
  });
});

test("polyglot fixture returns exact fallback evidence for common config formats", () => {
  withFixtureGitRepo("polyglot-fallback-repo", (repoPath) => {
    const { output, artifactJson } = runCompile(repoPath, [
      "compile",
      "--task",
      [
        "Review fallback context in",
        "config/service-config.json",
        "config/routes.config.yaml",
        "config/limits.config.toml"
      ].join(" "),
      "--session",
      "polyglot-configs"
    ]);
    const exactEvidence = section(artifactJson, "exact-source-evidence");
    const blindSpots = section(artifactJson, "index-blind-spots");

    assert.equal(output.warnings.includes("repository_artifact_uses_lightweight_index"), true);
    assertExactEvidenceContains(exactEvidence, [
      ["config/service-config.json", "invoice_batch_limit"],
      ["config/routes.config.yaml", "checkout_route_slo_minutes"],
      ["config/limits.config.toml", "support_escalation_minutes"]
    ]);
    assert.match(blindSpots.text, /Generic text fallback selected languages: json, toml, yaml\./);
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

function assertExactEvidenceContains(exactEvidence, expectedPairs) {
  for (const [sourceRef, token] of expectedPairs) {
    assert.match(exactEvidence.text, new RegExp(`Source: ${escapeRegex(sourceRef)}`));
    assert.match(exactEvidence.text, new RegExp(escapeRegex(token)));
    assert.equal(exactEvidence.itemRefs.some((ref) => ref.ref === sourceRef), true);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
