import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { encodeMcpFrame, parseMcpFrames } from "./mcp-smoke-session.mjs";
import { commandForPlatform, installedBinForPlatform, spawnFailureMessage } from "./platform-command.mjs";
import { assertNodeSqliteAvailable, envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const root = process.cwd();
const sourcePackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const npmCacheDir = path.join(root, ".tmp", "npm-cache-e2e-alpha");
assertNodeSqliteAvailable();
mkdirSync(npmCacheDir, { recursive: true });

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
  const build = spawnSync(commandForPlatform("npm"), ["run", "build"], { cwd: root, encoding: "utf8" });
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
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  const pack = spawnSync(commandForPlatform("npm"), ["pack", "--pack-destination", packDir, "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
    env: npmEnv()
  });
  if (pack.status !== 0) throw new Error(spawnFailureMessage(pack));
  const packedTarball = pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1) throw new Error(`npm pack must produce exactly one tarball, found ${tarballs.length}`);
  const tarball = tarballs[0];
  if (tarball !== packedTarball) {
    throw new Error(`selected tarball ${tarball} must match npm pack output ${packedTarball}`);
  }

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

    const install = spawnSync(commandForPlatform("npm"), ["install", path.join(packDir, tarball)], {
      cwd: consumerRepo,
      encoding: "utf8",
      env: npmEnv()
    });
    if (install.status !== 0) throw new Error(spawnFailureMessage(install));

    const grapeBin = installedBinForPlatform(path.join(consumerRepo, "node_modules", ".bin", "grape"));
    if (!existsSync(grapeBin)) throw new Error("missing node_modules/.bin/grape");
    assertInstalledPackageMetadata(consumerRepo);

    const spawnGrape = (args) =>
      spawnSync(grapeBin, args, {
        cwd: consumerRepo,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: envWithSqliteNodeOptions(npmEnv())
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
    if (!secondJson.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE")) {
      throw new Error("second compile missing RESTORE_AVAILABLE");
    }

    runMcpInstalledSmoke(grapeBin, consumerRepo);
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

function npmEnv() {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_cache: npmCacheDir,
    npm_config_fund: "false",
    npm_config_update_notifier: "false"
  };
}

function assertInstalledPackageMetadata(consumerRepo) {
  const packageJsonPath = path.join(consumerRepo, "node_modules", ...sourcePackage.name.split("/"), "package.json");
  if (!existsSync(packageJsonPath)) throw new Error(`installed package is missing ${sourcePackage.name}/package.json`);
  const installedPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (installedPackage.name !== sourcePackage.name) {
    throw new Error(`installed package name must be ${sourcePackage.name}`);
  }
  if (installedPackage.version !== sourcePackage.version) {
    throw new Error(`installed package version must be ${sourcePackage.version}`);
  }
  if (installedPackage.engines?.node !== sourcePackage.engines?.node) {
    throw new Error(`installed package Node engine must be ${sourcePackage.engines?.node}`);
  }
}

function runMcpInstalledSmoke(grapeBin, repoPath) {
  const input = Buffer.concat([
    encodeMcpFrame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "grape-e2e-alpha", version: sourcePackage.version }
      }
    }),
    encodeMcpFrame({ jsonrpc: "2.0", method: "notifications/initialized" }),
    encodeMcpFrame({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    }),
    encodeMcpFrame({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "grape_get_context",
        arguments: { query: "e2e mcp smoke", sessionId: "e2e-alpha-mcp" }
      }
    }),
    encodeMcpFrame({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "grape_get_context",
        arguments: { query: "e2e mcp smoke", sessionId: "e2e-alpha-mcp" }
      }
    })
  ]);

  const result = spawnSync(grapeBin, ["mcp", "--stdio", "--repo", repoPath], {
    cwd: repoPath,
    input,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
    env: envWithSqliteNodeOptions(npmEnv())
  });
  if (result.status !== 0) throw new Error(result.stderr.toString("utf8").trim() || "installed grape mcp failed");

  const messages = parseMcpFrames(result.stdout);
  const byId = new Map(messages.map((message) => [message.id, message]));
  if (!byId.get(1)?.result?.capabilities?.tools) throw new Error("mcp initialize missing tool capabilities");

  const toolNames = new Set(byId.get(2)?.result?.tools?.map((tool) => tool.name));
  if (!toolNames.has("grape_get_context")) throw new Error("mcp tools/list missing grape_get_context");
  if (!toolNames.has("grape_get_omitted_item")) throw new Error("mcp tools/list missing grape_get_omitted_item");

  const first = byId.get(3)?.result;
  if (!first || first.isError === true) throw new Error(first?.content?.[0]?.text ?? "first mcp context call failed");
  if (!first.structuredContent.contextPackItems.some((item) => item.state === "NEW")) {
    throw new Error("first mcp context call missing NEW items");
  }

  const second = byId.get(4)?.result;
  if (!second || second.isError === true) throw new Error(second?.content?.[0]?.text ?? "second mcp context call failed");
  if (!second.structuredContent.contextPackItems.some((item) => item.state === "OMIT_UNCHANGED")) {
    throw new Error("second mcp context call missing OMIT_UNCHANGED");
  }
  if (!second.structuredContent.contextPackItems.some((item) => item.state === "RESTORE_AVAILABLE")) {
    throw new Error("second mcp context call missing RESTORE_AVAILABLE");
  }
}
