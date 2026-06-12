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
    assert.equal(languageForPath("internal/refund.go"), "go");
    assert.equal(languageForPath("rust/src/lib.rs"), "rust");
    assert.equal(languageForPath("dotnet/BillingLimit.cs"), "csharp");
    assert.equal(languageForPath("ruby/lib/refund_policy.rb"), "ruby");
    assert.equal(languageForPath("php/src/TaxPolicy.php"), "php");
    assert.equal(languageForPath("swift/Sources/Checkout/AccessWindow.swift"), "swift");
    assert.equal(languageForPath("native/src/retry_budget.c"), "c");
    assert.equal(languageForPath("native/src/audit_bridge.cpp"), "cpp");
    assert.equal(languageForPath("native/include/audit_bridge.hpp"), "cpp");
    assert.equal(languageForPath("scripts/deploy-check.sh"), "shell");
    assert.equal(languageForPath("docs/operations.md"), "markdown");
    assert.equal(languageForPath("config/service-config.json"), "json");
    assert.equal(languageForPath("config/routes.config.yaml"), "yaml");
    assert.equal(languageForPath("config/limits.config.toml"), "toml");
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
