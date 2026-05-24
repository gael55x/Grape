import type { DatabaseSync } from "node:sqlite";

export interface SqliteConnectionPolicy {
  readonly journalMode: "WAL";
  readonly foreignKeys: true;
  readonly busyTimeoutMs: number;
  readonly synchronous: "NORMAL";
  readonly tempStore: "MEMORY";
}

export const defaultSqliteConnectionPolicy: SqliteConnectionPolicy = {
  journalMode: "WAL",
  foreignKeys: true,
  busyTimeoutMs: 5000,
  synchronous: "NORMAL",
  tempStore: "MEMORY"
};

export function createSqlitePragmaStatements(
  policy: SqliteConnectionPolicy = defaultSqliteConnectionPolicy
): readonly string[] {
  if (!Number.isInteger(policy.busyTimeoutMs) || policy.busyTimeoutMs <= 0) {
    throw new Error("sqlite busy timeout must be a positive integer");
  }

  return [
    `PRAGMA journal_mode = ${policy.journalMode};`,
    `PRAGMA foreign_keys = ${policy.foreignKeys ? "ON" : "OFF"};`,
    `PRAGMA busy_timeout = ${policy.busyTimeoutMs};`,
    `PRAGMA synchronous = ${policy.synchronous};`,
    `PRAGMA temp_store = ${policy.tempStore};`
  ];
}

export function applySqliteConnectionPolicy(
  database: DatabaseSync,
  policy: SqliteConnectionPolicy = defaultSqliteConnectionPolicy
): void {
  database.exec(createSqlitePragmaStatements(policy).join("\n"));
}
