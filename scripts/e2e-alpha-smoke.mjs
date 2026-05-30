import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { assertNodeSqliteAvailable, envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const root = process.cwd();
assertNodeSqliteAvailable();

const steps = [];

function runStep(name, fn) {
  try {
    fn();
    steps.push({ name, status: "ok" });
    console.log(`ok ${name}`);
  } catch (error) {
    steps.push({ name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
    console.error(`fail ${name}: ${steps.at(-1)?.detail}`);
    reportAndExit(1);
  }
}

runStep("build dist", () => {
  const build = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
  if (build.status !== 0) throw new Error(build.stderr.trim() || "npm run build failed");
});

runStep("local grape help", () => {
  const help = spawnSync(process.execPath, [path.join(root, "dist/cli/index.js"), "help"], {
    cwd: root,
    encoding: "utf8",
    env: envWithSqliteNodeOptions()
  });
  if (help.status !== 0 || !help.stdout.includes("grape")) {
    throw new Error(help.stderr.trim() || "dist/cli help failed");
  }
});

runStep("pack install smoke", () => {
  const packDir = path.join(root, ".tmp", "e2e-pack");
  mkdirSync(packDir, { recursive: true });
  const pack = spawnSync("npm", ["pack", "--pack-destination", packDir, "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8"
  });
  if (pack.status !== 0) throw new Error(pack.stderr.trim());
  const tarball = readdirSync(packDir).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");

  const consumerRepo = mkdtempSync(path.join(tmpdir(), "grape-e2e-"));
  try {
    writeFileSync(path.join(consumerRepo, "README.md"), "# e2e\n");
    writeFileSync(path.join(consumerRepo, ".gitignore"), "node_modules/\n");
    spawnSync("git", ["init", "-b", "main"], { cwd: consumerRepo, stdio: "ignore" });
    spawnSync("git", ["add", "README.md"], { cwd: consumerRepo, stdio: "ignore" });
    spawnSync(
      "git",
      ["-c", "user.name=Grape E2E", "-c", "user.email=e2e@grape.test", "commit", "-m", "init"],
      { cwd: consumerRepo, stdio: "ignore" }
    );

    const install = spawnSync("npm", ["install", path.join(packDir, tarball)], {
      cwd: consumerRepo,
      encoding: "utf8"
    });
    if (install.status !== 0) throw new Error(install.stderr.trim());

    const grapeBin = path.join(consumerRepo, "node_modules", ".bin", "grape");
    if (!existsSync(grapeBin)) throw new Error("missing node_modules/.bin/grape");

    const spawnGrape = (args) =>
      spawnSync(grapeBin, args, {
        cwd: consumerRepo,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: envWithSqliteNodeOptions()
      });

    const help = spawnGrape(["help"]);
    if (help.status !== 0 || !help.stdout.includes("grape")) throw new Error("installed grape help failed");

    const init = spawnGrape(["init", "--connect"]);
    if (init.status !== 0) throw new Error(init.stderr.trim() || "grape init failed");

    const compileArgs = ["compile", "--task", "e2e smoke", "--json"];
    const first = spawnGrape(compileArgs);
    if (first.status !== 0) throw new Error(first.stderr.trim() || "first compile failed");
    const second = spawnGrape(compileArgs);
    if (second.status !== 0) throw new Error(second.stderr.trim() || "second compile failed");

    const secondJson = JSON.parse(second.stdout);
    if (!Array.isArray(secondJson.contextPackItems)) throw new Error("second compile missing contextPackItems");
    if (!secondJson.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED")) {
      throw new Error("second compile missing OMIT_UNCHANGED");
    }
  } finally {
    rmSync(consumerRepo, { recursive: true, force: true });
  }
});

runStep("benchmark suite", () => {
  const bench = spawnSync("node", ["scripts/run-benchmark-suite.mjs"], { cwd: root, encoding: "utf8" });
  if (bench.status !== 0) throw new Error(bench.stdout.trim() || bench.stderr.trim() || "benchmark suite failed");
});

reportAndExit(0);

function reportAndExit(code) {
  if (code === 0) console.log("\ne2e alpha smoke ok");
  process.exit(code);
}
