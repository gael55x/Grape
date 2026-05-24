import assert from "node:assert/strict";
import test from "node:test";

import { planPendingStorageMigrations } from "../../.tmp/build/src/core/storage/index.js";

const migrationOne = {
  id: "0001",
  filename: "0001_alpha_storage_subset.sql",
  checksumSha256: "a".repeat(64)
};

const migrationTwo = {
  id: "0002",
  filename: "0002_next.sql",
  checksumSha256: "b".repeat(64)
};

test("storage migration planner returns already applied and pending migrations", () => {
  const plan = planPendingStorageMigrations(
    [migrationOne, migrationTwo],
    [{ ...migrationOne, appliedAt: "2026-05-24T00:00:00.000Z" }]
  );

  assert.deepEqual(plan.alreadyApplied, [migrationOne]);
  assert.deepEqual(plan.pending, [migrationTwo]);
});

test("storage migration planner rejects checksum drift", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations(
        [migrationOne],
        [{ ...migrationOne, checksumSha256: "c".repeat(64), appliedAt: "2026-05-24T00:00:00.000Z" }]
      ),
    /checksum changed/
  );
});

test("storage migration planner rejects unknown applied migrations", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations([], [
        { ...migrationOne, appliedAt: "2026-05-24T00:00:00.000Z" }
      ]),
    /not available/
  );
});

test("storage migration planner rejects out-of-order available migrations", () => {
  assert.throws(
    () => planPendingStorageMigrations([migrationTwo, migrationOne], []),
    /sorted by id/
  );
});
