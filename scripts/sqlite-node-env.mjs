import { spawnSync } from "node:child_process";

/** Node 22.5–22.12 needs --experimental-sqlite; 22.13+ enables node:sqlite by default. */
export function nodeSqliteNeedsExperimentalFlag(version = process.versions.node) {
  const match = /^(\d+)\.(\d+)\./.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major === 22 && minor >= 5 && minor < 13;
}

export function envWithSqliteNodeOptions(baseEnv = process.env) {
  if (!nodeSqliteNeedsExperimentalFlag()) return baseEnv;
  const flag = "--experimental-sqlite";
  const existing = baseEnv.NODE_OPTIONS?.trim();
  if (existing?.includes(flag)) return baseEnv;
  return {
    ...baseEnv,
    NODE_OPTIONS: existing ? `${existing} ${flag}` : flag
  };
}

export function assertNodeSqliteAvailable(version = process.versions.node) {
  const env = envWithSqliteNodeOptions();
  const probe = spawnSync(process.execPath, ["-e", "import('node:sqlite')"], {
    env,
    encoding: "utf8"
  });
  if (probe.status === 0) return;

  const hint = nodeSqliteNeedsExperimentalFlag(version)
    ? "On Node 22.5–22.12, run with NODE_OPTIONS=--experimental-sqlite."
    : "Use Node.js 22.13 or newer (see package engines).";

  throw new Error(
    `node:sqlite is not available on Node ${version}. ${hint}\n${probe.stderr.trim()}`
  );
}
