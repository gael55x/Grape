import assert from "node:assert/strict";
import test from "node:test";

import {
  createSqlitePragmaStatements,
  defaultSqliteConnectionPolicy
} from "../../.tmp/build/src/core/storage/index.js";

test("sqlite policy defaults to WAL, foreign keys, and busy timeout", () => {
  assert.deepEqual(defaultSqliteConnectionPolicy, {
    journalMode: "WAL",
    foreignKeys: true,
    busyTimeoutMs: 5000,
    synchronous: "NORMAL",
    tempStore: "MEMORY"
  });

  assert.deepEqual(createSqlitePragmaStatements(), [
    "PRAGMA journal_mode = WAL;",
    "PRAGMA foreign_keys = ON;",
    "PRAGMA busy_timeout = 5000;",
    "PRAGMA synchronous = NORMAL;",
    "PRAGMA temp_store = MEMORY;"
  ]);
});

test("sqlite policy rejects invalid busy timeouts", () => {
  assert.throws(
    () =>
      createSqlitePragmaStatements({
        ...defaultSqliteConnectionPolicy,
        busyTimeoutMs: 0
      }),
    /busy timeout/
  );
});
