import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface PreparedBenchmarkFixture {
  readonly workspacePath: string;
  readonly repoPath: string;
  cleanup(): void;
}

export function prepareBenchmarkFixtureRepository(input: {
  readonly fixtureName: string;
  readonly fixturePath: string;
  readonly gitBinary?: string;
  readonly keepWorkspace?: boolean;
}): PreparedBenchmarkFixture {
  const fixturePath = path.resolve(input.fixturePath);
  if (!existsSync(fixturePath)) {
    throw new Error("benchmark fixture not found");
  }

  const workspacePath = mkdtempSync(path.join(tmpdir(), "grape-bench-"));
  const repoPath = path.join(workspacePath, safeFixtureDirName(input.fixtureName));
  cpSync(fixturePath, repoPath, {
    recursive: true,
    filter: (source) => shouldCopyFixturePath(fixturePath, source)
  });

  const gitBinary = input.gitBinary ?? "git";
  execGit(gitBinary, repoPath, ["init", "-b", "main"]);
  execGit(gitBinary, repoPath, ["add", "."]);
  execGit(gitBinary, repoPath, [
    "-c",
    "user.name=Grape Benchmark",
    "-c",
    "user.email=benchmark@grape.local",
    "commit",
    "-m",
    "benchmark fixture"
  ]);

  return {
    workspacePath,
    repoPath,
    cleanup() {
      if (!input.keepWorkspace) {
        rmSync(workspacePath, { recursive: true, force: true });
      }
    }
  };
}

function safeFixtureDirName(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized.length > 0 ? normalized : "fixture";
}

function shouldCopyFixturePath(rootPath: string, sourcePath: string): boolean {
  const relativePath = path.relative(rootPath, sourcePath);
  if (relativePath === "") return true;

  const segments = relativePath.split(path.sep);
  if (segments.includes(".git") || segments.includes("node_modules")) return false;
  if (segments[0] !== ".grape") return true;

  const localStateName = segments[1];
  if (!localStateName) return true;
  if (localStateName === "grape.db" || localStateName === "artifacts" || localStateName === "config.json") {
    return false;
  }
  return !localStateName.startsWith("config.invalid.");
}

export function execGitInBenchmarkRepo(gitBinary: string, repoPath: string, args: readonly string[]): string {
  return execFileSync(gitBinary, ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function execGit(gitBinary: string, repoPath: string, args: readonly string[]): string {
  return execGitInBenchmarkRepo(gitBinary, repoPath, args);
}
