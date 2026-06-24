import assert from "node:assert/strict";
import test from "node:test";

import { selectFileIndexProvider } from "../../../.tmp/build/src/core/indexing/index.js";

test("file index provider dispatch selects TypeScript AST extraction for JS and TS paths", () => {
  for (const repoPath of ["src/app.ts", "src/app.jsx"]) {
    const selection = selectFileIndexProvider(
      repoPath,
      [
        "import { helper } from './helper';",
        "",
        "export function runApp() {",
        "  return helper();",
        "}",
        ""
      ].join("\n")
    );

    assert.equal(selection.extractor, "typescript_ast");
    assert.equal(selection.provider.providerId, "typescript_ast");
    assert.equal(selection.provider.language, repoPath.endsWith(".ts") ? "typescript" : "javascript_jsx");
    assert.deepEqual(selection.provider.providerCapabilities, [
      "lexical_path",
      "symbols_ast",
      "module_edges",
      "test_edges",
      "type_aware_edges"
    ]);
    assert.deepEqual(selection.provider.providerDiagnostics, []);
    assert.ok(selection.ast);
    assert.equal(selection.ast.symbols.some((symbol) => symbol.name === "runApp"), true);
    assert.equal(selection.ast.imports.some((candidate) => candidate.specifier === "./helper"), true);
  }
});

test("file index provider dispatch keeps unsupported languages on generic text fallback", () => {
  const selection = selectFileIndexProvider(
    "src/pricing.py",
    [
      "def price_total(value):",
      "    return value",
      ""
    ].join("\n")
  );

  assert.equal(selection.extractor, "regex_basic");
  assert.equal(selection.provider.providerId, "generic_text");
  assert.equal(selection.provider.language, "python");
  assert.deepEqual(selection.provider.providerCapabilities, ["lexical_path", "symbols_basic"]);
  assert.deepEqual(selection.provider.providerDiagnostics, [
    {
      code: "provider_capability_gap",
      severity: "warning",
      capability: "module_edges"
    },
    {
      code: "provider_capability_gap",
      severity: "warning",
      capability: "test_edges"
    }
  ]);
  assert.equal(selection.ast, undefined);
});
