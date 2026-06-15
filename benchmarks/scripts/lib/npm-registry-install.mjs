import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  commandForPlatform,
  installedPackageBinTarget,
  spawnFailureMessage,
  spawnOptionsForPlatform
} from "../../../scripts/platform-command.mjs";
import { npmEnv } from "./tarball-install.mjs";

const PACKAGE_NAME = "grape-context";
const PACKAGE_SPEC = `${PACKAGE_NAME}@beta`;

export function resolvePublishedInstallSpec() {
  return {
    installArgs: [PACKAGE_SPEC],
    distTag: "beta",
    installCommand: `npm install ${PACKAGE_SPEC}`
  };
}

/**
 * Install published grape-context from the npm registry into a fresh consumer workspace.
 */
export function installPublishedBeta(options = {}) {
  const npmCacheDir = options.npmCacheDir ?? path.join(options.root ?? process.cwd(), ".tmp", "npm-cache-bench-post-beta");
  const spec = resolvePublishedInstallSpec();
  const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-bench-post-beta-"));
  const installPathBasename = path.basename(consumerRepo);

  const init = spawnSync(
    commandForPlatform("npm"),
    ["init", "-y"],
    spawnOptionsForPlatform({
      cwd: consumerRepo,
      encoding: "utf8",
      env: npmEnv(npmCacheDir)
    })
  );
  if (init.status !== 0) {
    rmSync(consumerRepo, { recursive: true, force: true });
    throw new Error(`npm init failed: ${spawnFailureMessage(init)}`);
  }

  const install = spawnSync(
    commandForPlatform("npm"),
    ["install", ...spec.installArgs],
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

  const grapeCli = installedPackageBinTarget(consumerRepo, PACKAGE_NAME, "dist/cli/index.js");
  if (!existsSync(grapeCli)) {
    rmSync(consumerRepo, { recursive: true, force: true });
    throw new Error(`installed package is missing dist/cli/index.js`);
  }

  const installedPackagePath = path.join(consumerRepo, "node_modules", PACKAGE_NAME, "package.json");
  const installedPackage = JSON.parse(readFileSync(installedPackagePath, "utf8"));

  return {
    grapeCli,
    consumerRepo,
    installPathBasename,
    installedVersion: installedPackage.version,
    distTag: spec.distTag,
    installCommand: spec.installCommand,
    artifactIdentity: `npm:${PACKAGE_NAME}@${installedPackage.version}`,
    artifactMode: "published-beta",
    installSource: "npm-registry",
    cleanup() {
      rmSync(consumerRepo, { recursive: true, force: true });
    }
  };
}
