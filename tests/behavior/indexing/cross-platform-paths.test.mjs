import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isIgnoredByPrivacyPolicy,
  loadPrivacyIgnorePolicy
} from "../../../.tmp/build/src/core/security/index.js";
import {
  languageForPath,
  resolveLocalImport,
  safeAbsolutePath
} from "../../../.tmp/build/src/core/indexing/index.js";

test("privacy ignore policy normalizes Windows-style separators", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-cross-platform-ignore-"));

  try {
    writeFileSync(path.join(rootPath, ".aiignore"), "src\\private.ts\n*.env\n");
    const policy = loadPrivacyIgnorePolicy(rootPath);

    assert.equal(isIgnoredByPrivacyPolicy("src/private.ts", policy), true);
    assert.equal(isIgnoredByPrivacyPolicy("src\\private.ts", policy), true);
    assert.equal(isIgnoredByPrivacyPolicy("config.env", policy), true);
    assert.equal(isIgnoredByPrivacyPolicy("nested\\config.env", policy), true);
    assert.equal(isIgnoredByPrivacyPolicy("src/public.ts", policy), false);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("index path helpers normalize separators and reject unsafe paths", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-cross-platform-index-"));

  try {
    assert.equal(languageForPath("src\\app.ts"), "typescript");
    assert.equal(safeAbsolutePath(rootPath, "src\\app.ts"), path.join(rootPath, "src", "app.ts"));
    assert.throws(() => safeAbsolutePath(rootPath, "..\\secret.ts"), /unsafe indexed path/);
    assert.throws(() => safeAbsolutePath(rootPath, "/tmp/secret.ts"), /unsafe indexed path/);
    assert.throws(() => safeAbsolutePath(rootPath, "C:\\secret.ts"), /unsafe indexed path/);
    assert.throws(() => safeAbsolutePath(rootPath, "\\\\server\\share\\secret.ts"), /unsafe indexed path/);
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

test("local import resolution handles Windows-style source paths", () => {
  const filePaths = new Set([
    "src/app.ts",
    "src/lib.ts",
    "src/components/Button/index.ts"
  ]);

  assert.equal(resolveLocalImport("src\\app.ts", "./lib", filePaths), "src/lib.ts");
  assert.equal(
    resolveLocalImport("src\\app.ts", "./components/Button", filePaths),
    "src/components/Button/index.ts"
  );
  assert.equal(resolveLocalImport("src\\app.ts", "../../../outside", filePaths), undefined);
});
