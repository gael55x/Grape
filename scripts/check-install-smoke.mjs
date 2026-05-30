import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const packDir = path.join(root, ".tmp", "install-smoke-pack");
const npmCacheDir = path.join(root, ".tmp", "npm-cache-install-smoke");

mkdirSync(packDir, { recursive: true });
mkdirSync(npmCacheDir, { recursive: true });

const pack = spawnSync("npm", ["pack", "--pack-destination", packDir, "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
  env: npmEnv(),
  stdio: ["ignore", "pipe", "pipe"]
});
assert(pack.status === 0, `npm pack failed: ${pack.stderr.trim()}`);

const tarball = readdirSync(packDir).find((name) => name.endsWith(".tgz"));
assert(tarball, "npm pack did not produce a tarball");

const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-install-smoke-"));
const tarballPath = path.join(packDir, tarball);

try {
  bootstrapGitRepo(consumerRepo);

  const install = spawnSync("npm", ["install", tarballPath], {
    cwd: consumerRepo,
    encoding: "utf8",
    env: npmEnv(),
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert(install.status === 0, `npm install failed: ${install.stderr.trim()}`);

  const grapeBin = path.join(consumerRepo, "node_modules", ".bin", "grape");
  assert(existsSync(grapeBin), "installed package is missing node_modules/.bin/grape");

  const spawnGrape = (args) =>
    spawnSync(grapeBin, args, {
      cwd: consumerRepo,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });

  const help = spawnGrape(["help"]);
  assert(help.status === 0, `grape help failed: ${help.stderr.trim()}`);
  assert(help.stdout.includes("grape"), "grape help produced no CLI output");

  const init = spawnGrape(["init", "--connect"]);
  assert(init.status === 0, `grape init failed: ${init.stderr.trim()}`);

  const compileArgs = ["compile", "--task", "install smoke", "--json"];
  const compile1 = spawnGrape(compileArgs);
  assert(compile1.status === 0, `first grape compile failed: ${compile1.stderr.trim() || compile1.error?.message}`);
  const first = JSON.parse(compile1.stdout);
  assert(Array.isArray(first.contextPackItems), "first compile JSON must include contextPackItems");

  const compile2 = spawnGrape(compileArgs);
  assert(compile2.status === 0, `second grape compile failed: ${compile2.stderr.trim() || compile2.error?.message}`);
  const second = JSON.parse(compile2.stdout);
  assert(Array.isArray(second.contextPackItems), "second compile JSON must include contextPackItems");

  console.log(`install smoke ok: ${tarball}`);
} finally {
  rmSync(consumerRepo, { recursive: true, force: true });
}

function bootstrapGitRepo(repoPath) {
  writeFileSync(path.join(repoPath, "README.md"), "# install smoke\n");
  writeFileSync(path.join(repoPath, ".gitignore"), "node_modules/\n");
  execFileSync("git", ["init", "-b", "main"], { cwd: repoPath, stdio: "ignore" });
  execFileSync("git", ["add", "README.md"], { cwd: repoPath, stdio: "ignore" });
  execFileSync(
    "git",
    ["-c", "user.name=Grape Install Smoke", "-c", "user.email=grape@example.test", "commit", "-m", "init"],
    { cwd: repoPath, stdio: "ignore" }
  );
}

function npmEnv() {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: npmCacheDir,
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
