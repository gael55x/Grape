import assert from "node:assert/strict";
import test from "node:test";

import { planPendingStorageMigrations } from "../../.tmp/build/src/core/storage/index.js";

const migrationOne = {
  id: "0001",
  filename: "0001_initial_storage.sql",
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

test("storage migration planner rejects filename drift", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations(
        [migrationOne],
        [
          {
            ...migrationOne,
            filename: "0001_renamed.sql",
            appliedAt: "2026-05-24T00:00:00.000Z"
          }
        ]
      ),
    /filename changed/
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

test("storage migration planner rejects out-of-order applied migrations", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations(
        [migrationOne, migrationTwo],
        [
          { ...migrationTwo, appliedAt: "2026-05-24T00:00:00.000Z" },
          { ...migrationOne, appliedAt: "2026-05-24T00:00:01.000Z" }
        ]
      ),
    /applied migrations must be sorted/
  );
});

test("storage migration planner rejects sparse applied migration history", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations(
        [migrationOne, migrationTwo],
        [{ ...migrationTwo, appliedAt: "2026-05-24T00:00:00.000Z" }]
      ),
    /prefix/
  );
});

test("storage migration planner rejects duplicate applied IDs", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations(
        [migrationOne],
        [
          { ...migrationOne, appliedAt: "2026-05-24T00:00:00.000Z" },
          { ...migrationOne, appliedAt: "2026-05-24T00:00:01.000Z" }
        ]
      ),
    /duplicate applied migration id/
  );
});

test("storage migration planner rejects invalid checksum shapes", () => {
  assert.throws(
    () =>
      planPendingStorageMigrations(
        [{ ...migrationOne, checksumSha256: "not-a-sha" }],
        []
      ),
    /invalid checksum/
  );
});
