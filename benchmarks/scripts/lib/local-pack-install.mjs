import { execFileSync } from "node:child_process";
import path from "node:path";

import { installBetaCandidateTarball } from "./tarball-install.mjs";
import { repoRoot } from "./environment.mjs";

/**
 * Build, pack, and install the current git tree into a fresh consumer workspace.
 */
export function installLocalCandidate(options = {}) {
  const root = options.root ?? repoRoot();
  const install = installBetaCandidateTarball({
    root,
    packDir: options.packDir,
    npmCacheDir: options.npmCacheDir
  });

  let gitCommit = "unknown";
  try {
    gitCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    // non-git checkout
  }

  const installPathBasename = path.basename(install.consumerRepo);

  return {
    grapeCli: install.grapeCli,
    consumerRepo: install.consumerRepo,
    installPathBasename,
    installedVersion: install.installedVersion,
    tarball: install.tarball,
    testedGitCommit: gitCommit,
    installCommand: "npm pack, then npm install <packed tgz> in fresh temp consumer",
    artifactIdentity: `local-candidate:${gitCommit}`,
    artifactMode: "local-candidate",
    installSource: "local-pack",
    cleanup: install.cleanup
  };
}
