import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  compileModes,
  contextInputKinds,
  contextPackItemKinds,
  contextSectionTypes,
  dependencyStrengths,
  diffStates
} from "../../.tmp/build/src/shared/index.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

test("public CLI context artifact JSON satisfies the V1 contract envelope", () => {
  withGitRepo((repoPath) => {
    const output = runCliJson(repoPath, [
      "compile",
      "--task",
      "Explain how the app entry point is exported",
      "--session",
      "contract-cli"
    ]);
    const artifactJson = JSON.parse(readFileSync(output.artifactJsonPath, "utf8"));

    assert.equal(artifactJson.artifactFormat, "grape.context-pack.v1");
    assert.equal(artifactJson.artifactFormatVersion, 1);
    assert.equal(artifactJson.contextPackItemShape, "ContextPackItem");
    assert.equal("artifact" in artifactJson, false);
    assert.equal(artifactJson.contextArtifact.id, output.artifactId);
    assert.deepEqual(
      artifactJson.contextPackItems.map((item) => item.id),
      output.contextPackItems.map((item) => item.id)
    );

    assertContextArtifactShape(artifactJson.contextArtifact);
    assertContextPackItems(artifactJson.contextPackItems, artifactJson.contextArtifact);
    assertMarkdownReferencesPackItems(
      readFileSync(output.artifactMarkdownPath, "utf8"),
      artifactJson.contextPackItems
    );
  });
});

test("MCP context pack Markdown renders the structured context pack items", () => {
  withGitRepo((repoPath) => {
    const responses = runMcp(repoPath, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } }
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "grape_get_context",
          arguments: {
            query: "Explain how the app entry point is exported",
            sessionId: "contract-mcp"
          }
        }
      }
    ]);

    const result = responses[1].result;

    assert.equal(result.isError, false);
    assertContextArtifactShape(result.structuredContent.contextArtifact);
    assertContextPackItems(result.structuredContent.contextPackItems, result.structuredContent.contextArtifact);
    assertMarkdownReferencesPackItems(
      result.structuredContent.contextPackMarkdown,
      result.structuredContent.contextPackItems
    );
  });
});

function assertContextArtifactShape(artifact) {
  for (const field of ["id", "projectId", "repoId", "repoSnapshotId", "worktreeStateId", "sessionId"]) {
    assertNonEmptyString(artifact[field], `contextArtifact.${field}`);
  }
  assert.equal(artifact.artifactFormatVersion, 1);
  assert.ok(compileModes.includes(artifact.compileMode), `unexpected compile mode ${artifact.compileMode}`);
  assertNonEmptyString(artifact.branch, "contextArtifact.branch");
  assertNonEmptyString(artifact.headCommit, "contextArtifact.headCommit");
  assert.equal(typeof artifact.dirtyWorktree, "boolean");
  assert.ok(Array.isArray(artifact.inputRefs));
  assert.ok(Array.isArray(artifact.outputSections));
  assert.ok(Array.isArray(artifact.compressionArtifactRefs));
  assert.ok(Array.isArray(artifact.compressionArtifactsUsed));
  assert.ok(artifact.outputSections.length > 0, "contextArtifact.outputSections should not be empty");
  for (const field of ["contentHash", "createdAt"]) assertNonEmptyString(artifact[field], `contextArtifact.${field}`);

  assertDependencyManifestShape(artifact);
  assertInputRefs(artifact.inputRefs);
  assertOutputSections(artifact.outputSections, artifact.dependencyManifest.dependencies);
}

function assertDependencyManifestShape(artifact) {
  const manifest = artifact.dependencyManifest;
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.artifactId, artifact.id);
  assertNonEmptyString(manifest.inputHash, "contextArtifact.dependencyManifest.inputHash");
  assertNonEmptyString(manifest.generatedAt, "contextArtifact.dependencyManifest.generatedAt");
  assert.ok(Array.isArray(manifest.dependencies));
  assert.ok(manifest.dependencies.length > 0, "dependency manifest should not be empty");

  for (const dependency of manifest.dependencies) {
    for (const field of ["id", "ref", "hash"]) assertNonEmptyString(dependency[field], `dependency.${field}`);
    assert.ok(contextInputKinds.includes(dependency.kind), `unexpected dependency kind ${dependency.kind}`);
    assert.equal(typeof dependency.scope?.repoId, "string");
    assert.ok(dependencyStrengths.includes(dependency.strength), `unexpected dependency strength ${dependency.strength}`);
    assert.equal(typeof dependency.requiredForSafety, "boolean");
    assert.ok(Array.isArray(dependency.invalidates));
  }
}

function assertInputRefs(inputRefs) {
  assert.ok(inputRefs.length > 0, "context artifact inputRefs should not be empty");
  for (const inputRef of inputRefs) {
    for (const field of ["id", "ref", "hash"]) assertNonEmptyString(inputRef[field], `inputRef.${field}`);
    assert.ok(contextInputKinds.includes(inputRef.kind), `unexpected inputRef kind ${inputRef.kind}`);
    assert.equal(typeof inputRef.scope?.repoId, "string");
    assert.ok(
      dependencyStrengths.includes(inputRef.dependencyStrength),
      `unexpected inputRef dependencyStrength ${inputRef.dependencyStrength}`
    );
    assert.equal(typeof inputRef.requiredForSafety, "boolean");
  }
}

function assertOutputSections(sections, dependencies) {
  const dependencyKeys = new Set(dependencies.map((dependency) => dependencyKey(dependency)));
  for (const section of sections) {
    for (const field of ["id", "title", "contentHash"]) assertNonEmptyString(section[field], `section.${field}`);
    assert.ok(contextSectionTypes.includes(section.type), `unexpected section type ${section.type}`);
    assert.equal(typeof section.text, "string");
    assert.ok(Array.isArray(section.itemRefs));
    assert.ok(section.itemRefs.length > 0, `section ${section.id} should include item refs`);
    assert.equal(typeof section.tokenCount, "number");
    assert.equal(typeof section.pinned, "boolean");
    assert.equal(typeof section.safetyCritical, "boolean");
    assert.equal(typeof section.requiresExactCode, "boolean");
    assert.equal(typeof section.canCompress, "boolean");
    assert.equal(typeof section.restoreable, "boolean");

    for (const itemRef of section.itemRefs) {
      assert.ok(contextInputKinds.includes(itemRef.kind), `unexpected section ref kind ${itemRef.kind}`);
      assertNonEmptyString(itemRef.ref, "section.itemRef.ref");
      assertNonEmptyString(itemRef.hash, "section.itemRef.hash");
      assert.ok(
        dependencyKeys.has(dependencyKey(itemRef)),
        `section ${section.id} item ref should resolve to dependency manifest`
      );
    }

    if (section.requiresExactCode) {
      assert.ok(
        section.itemRefs.some((ref) => ref.kind === "proof" || ref.kind === "file" || ref.kind === "claim"),
        `exact section ${section.id} should reference proof, file, or claim inputs`
      );
    }
  }
}

function assertContextPackItems(items, artifact) {
  assert.ok(items.length > 0, "contextPackItems should not be empty");
  const artifactInputKeys = new Set(artifact.inputRefs.map((inputRef) => dependencyKey(inputRef)));

  for (const item of items) {
    for (const field of ["id", "itemRef", "title", "contentHash"]) {
      assertNonEmptyString(item[field], `contextPackItem.${field}`);
    }
    assert.ok(diffStates.includes(item.state), `unexpected context pack state ${item.state}`);
    assert.ok(contextPackItemKinds.includes(item.itemKind), `unexpected context pack item kind ${item.itemKind}`);
    assert.equal(typeof item.content, "string");
    assert.equal("body" in item, false);
    assert.equal(typeof item.tokenCount, "number");
    assert.equal(typeof item.pinned, "boolean");
    assert.equal(typeof item.safetyCritical, "boolean");
    assert.ok(Array.isArray(item.inputRefs));
    assert.ok(item.inputRefs.length > 0, `context pack item ${item.id} should include input refs`);
    assert.ok(Array.isArray(item.warnings));

    for (const inputRef of item.inputRefs) {
      assert.ok(contextInputKinds.includes(inputRef.kind), `unexpected pack input kind ${inputRef.kind}`);
      for (const field of ["id", "ref", "hash"]) {
        assertNonEmptyString(inputRef[field], `contextPackItem.inputRef.${field}`);
      }
      assert.ok(artifactInputKeys.has(dependencyKey(inputRef)), `pack item ${item.id} input should resolve to artifact input`);
    }
  }
}

function assertMarkdownReferencesPackItems(markdown, items) {
  assert.match(markdown, new RegExp(`Total context pack items: ${items.length}`));
  for (const item of items) {
    assert.match(markdown, new RegExp(`Item: ${escapeRegExp(item.id)}`));
    assert.match(markdown, new RegExp(`Kind: ${escapeRegExp(item.itemKind)}`));
    assert.match(markdown, new RegExp(`Item ref: ${escapeRegExp(item.itemRef)}`));
    assert.match(markdown, new RegExp(`Content hash: ${escapeRegExp(item.contentHash)}`));
  }
}

const dependencyKey = (input) => `${input.kind}:${input.ref}:${input.hash}`;

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, "string", `${label} should be a string`);
  assert.ok(value.length > 0, `${label} should not be empty`);
}

function withGitRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "grape-context-artifact-contract-"));

  try {
    execGit(dir, ["init", "-b", "main"]);
    mkdirSync(path.join(dir, "src"), { recursive: true });
    writeFileSync(path.join(dir, "README.md"), "# Fixture\n");
    writeFileSync(path.join(dir, "AGENTS.md"), "Prefer exact source evidence for implementation changes.\n");
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture", type: "module" }, null, 2));
    writeFileSync(path.join(dir, "src", "app.ts"), "export function startApp() {\n  return 'ready';\n}\n");
    execGit(dir, ["add", "README.md", "AGENTS.md", "package.json", "src/app.ts"]);
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

function runCliJson(repoPath, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args, "--json"], {
    cwd: repoPath,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function runMcp(repoPath, messages) {
  const input = Buffer.concat(messages.map(requestFrame));
  const result = spawnSync(process.execPath, [cliPath, "mcp", "--stdio", "--repo", repoPath], {
    cwd: repoPath,
    input,
    encoding: "buffer"
  });
  assert.equal(result.status, 0, result.stderr.toString("utf8"));
  assert.equal(result.stderr.toString("utf8"), "");
  return parseFrames(result.stdout);
}

function requestFrame(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

function parseFrames(buffer) {
  const messages = [];
  let rest = Buffer.from(buffer);
  while (rest.length > 0) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    assert.notEqual(headerEnd, -1, `missing MCP frame header in ${rest.toString("utf8")}`);
    const header = rest.subarray(0, headerEnd).toString("utf8");
    const match = /^Content-Length:\s*(\d+)$/im.exec(header);
    assert.ok(match, `missing content length in ${header}`);
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    assert.ok(rest.length >= bodyEnd, "incomplete MCP body");
    messages.push(JSON.parse(rest.subarray(bodyStart, bodyEnd).toString("utf8")));
    rest = rest.subarray(bodyEnd);
  }
  return messages;
}

function execGit(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
