import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function repoRoot() {
  return path.resolve(import.meta.dirname, "../../..");
}

export function readPackageJson(root = repoRoot()) {
  return JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
}

export function captureEnvironment(root = repoRoot()) {
  const pkg = readPackageJson(root);
  let gitCommit = "unknown";
  let gitBranch = "unknown";
  try {
    gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    gitBranch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    // non-git checkout
  }

  let npmVersion = "unknown";
  try {
    npmVersion = execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    // ignore
  }

  return {
    capturedAt: new Date().toISOString(),
    grapePackageName: pkg.name,
    grapePackageVersion: pkg.version,
    gitCommit,
    gitBranch,
    nodeVersion: process.version,
    npmVersion,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10
  };
}
