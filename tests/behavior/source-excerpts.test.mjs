import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readLocalSourceExcerpts } from "../../.tmp/build/src/app/index.js";

test("local source excerpts require matching source bytes and safe repo paths", () => {
  const rootPath = mkdtempSync(path.join(tmpdir(), "grape-source-excerpts-"));
  try {
    mkdirSync(path.join(rootPath, "src"));
    const sourceRef = "src/app.ts";
    const sourcePath = path.join(rootPath, sourceRef);
    const sourceText = "export function runApp() {\n  return true;\n}\n";
    writeFileSync(sourcePath, sourceText);

    const source = {
      sourceId: "source-1",
      sourceType: "repository_file",
      sourceRef,
      sourceHash: sha256(Buffer.from(sourceText, "utf8")),
      sourceScope: "committed",
      privacyStatus: "allowed",
      trustClass: "trusted",
      redactionStatus: "not_needed"
    };

    const excerpts = readLocalSourceExcerpts({ rootPath, sources: [source] });
    assert.equal(excerpts.length, 1);
    assert.equal(excerpts[0].sourceRef, sourceRef);
    assert.match(excerpts[0].proofId, /^proof:/);
    assert.match(excerpts[0].excerpt, /export function runApp/);

    writeFileSync(sourcePath, "export function runApp() {\n  return false;\n}\n");
    assert.deepEqual(readLocalSourceExcerpts({ rootPath, sources: [source] }), []);

    assert.doesNotThrow(() =>
      readLocalSourceExcerpts({
        rootPath,
        sources: [{ ...source, sourceId: "source-unsafe", sourceRef: "../secret.txt" }]
      })
    );
    assert.deepEqual(
      readLocalSourceExcerpts({
        rootPath,
        sources: [{ ...source, sourceId: "source-unsafe", sourceRef: "../secret.txt" }]
      }),
      []
    );
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
