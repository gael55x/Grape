import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  commandForPlatform,
  installedPackageBinTarget,
  spawnFailureMessage,
  spawnOptionsForPlatform
} from "../../../scripts/platform-command.mjs";
import { envWithSqliteNodeOptions } from "../../../scripts/sqlite-node-env.mjs";
import { readPackageJson, repoRoot } from "./environment.mjs";

export function npmEnv(cacheDir) {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: cacheDir,
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
}

/**
 * Build dist, pack, and install the current tree into a throwaway consumer repo.
 * Returns the installed grape CLI entrypoint for the beta candidate tarball.
 */
export function installBetaCandidateTarball(options = {}) {
  const root = options.root ?? repoRoot();
  const packDir = options.packDir ?? path.join(root, ".tmp", "bench-beta-pack");
  const npmCacheDir = options.npmCacheDir ?? path.join(root, ".tmp", "npm-cache-bench-beta");
  const sourcePackage = readPackageJson(root);

  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  mkdirSync(npmCacheDir, { recursive: true });

  const build = spawnSync(
    commandForPlatform("npm"),
    ["run", "build"],
    spawnOptionsForPlatform({
      cwd: root,
      encoding: "utf8",
      env: npmEnv(npmCacheDir)
    })
  );
  if (build.status !== 0) {
    throw new Error(`npm run build failed: ${spawnFailureMessage(build)}`);
  }

  const pack = spawnSync(
    commandForPlatform("npm"),
    ["pack", "--pack-destination", packDir, "--ignore-scripts"],
    spawnOptionsForPlatform({
      cwd: root,
      encoding: "utf8",
      env: npmEnv(npmCacheDir),
      stdio: ["ignore", "pipe", "pipe"]
    })
  );
  if (pack.status !== 0) {
    throw new Error(`npm pack failed: ${spawnFailureMessage(pack)}`);
  }

  const packedTarball = pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`npm pack must produce exactly one tarball, found ${tarballs.length}`);
  }
  const tarball = tarballs[0];
  if (tarball !== packedTarball) {
    throw new Error(`selected tarball ${tarball} must match npm pack output ${packedTarball}`);
  }

  const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-bench-beta-"));
  const install = spawnSync(
    commandForPlatform("npm"),
    ["install", path.join(packDir, tarball)],
    spawnOptionsForPlatform({
      cwd: consumerRepo,
      encoding: "utf8",
      env: npmEnv(npmCacheDir)
    })
  );
  if (install.status !== 0) {
    rmSync(consumerRepo, { recursive: true, force: true });
    throw new Error(`npm install failed: ${spawnFailureMessage(install)}`);
  }

  const grapeCli = installedPackageBinTarget(consumerRepo, sourcePackage.name, sourcePackage.bin.grape);
  if (!existsSync(grapeCli)) {
    rmSync(consumerRepo, { recursive: true, force: true });
    throw new Error(`installed package is missing ${sourcePackage.bin.grape}`);
  }

  const installedPackagePath = path.join(consumerRepo, "node_modules", ...sourcePackage.name.split("/"), "package.json");
  const installedPackage = JSON.parse(readFileSync(installedPackagePath, "utf8"));

  return {
    grapeCli,
    tarball,
    tarballPath: path.join(packDir, tarball),
    consumerRepo,
    installedVersion: installedPackage.version,
    cleanup() {
      rmSync(consumerRepo, { recursive: true, force: true });
    }
  };
}

export function spawnInstalledGrape(grapeCli, args, options = {}) {
  const root = options.root ?? repoRoot();
  return spawnSync(process.execPath, [grapeCli, ...args], spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: envWithSqliteNodeOptions(npmEnv(options.npmCacheDir ?? path.join(root, ".tmp", "npm-cache-bench-beta"))),
    shell: false
  }));
}
