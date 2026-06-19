import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { runMcpContextRestoreSession } from "./mcp-smoke-session.mjs";
import { commandForPlatform, spawnFailureMessage, spawnOptionsForPlatform } from "./platform-command.mjs";
import { assertNodeSqliteAvailable, envWithSqliteNodeOptions } from "./sqlite-node-env.mjs";

const root = process.cwd();
const sourcePackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const distCli = path.join(root, "dist", "cli", "index.js");
const codexHome = mkdtempSync(path.join(tmpdir(), "grape-codex-home-"));
const codexXdg = mkdtempSync(path.join(tmpdir(), "grape-codex-xdg-"));
const workflowRepo = mkdtempSync(path.join(tmpdir(), "grape-codex-workflow-"));

assertNodeSqliteAvailable();
assert(existsSync(distCli), "dist/cli/index.js is missing; run npm run build before codex:check");

try {
  bootstrapWorkflowRepo(workflowRepo);
  verifyGrapeCodexConfigWorkflow(workflowRepo);
  await verifyGrapeMcpWorkflow(workflowRepo);
  verifyPluginConfig();
  verifyCodexCliPluginWorkflow();
  console.log("codex workflow ok");
} finally {
  rmSync(workflowRepo, { recursive: true, force: true });
  rmSync(codexHome, { recursive: true, force: true });
  rmSync(codexXdg, { recursive: true, force: true });
}

function bootstrapWorkflowRepo(repoPath) {
  writeFileSync(path.join(repoPath, "README.md"), "# Codex workflow\n");
  writeFileSync(path.join(repoPath, "package.json"), JSON.stringify({ name: "codex-workflow", type: "module" }, null, 2) + "\n");
  runGit(repoPath, ["init", "-b", "main"]);
  runGit(repoPath, ["add", "README.md", "package.json"]);
  runGit(repoPath, [
    "-c",
    "user.name=Grape Codex Workflow",
    "-c",
    "user.email=codex-workflow@grape.test",
    "commit",
    "-m",
    "initial codex workflow fixture"
  ]);
}

function verifyGrapeCodexConfigWorkflow(repoPath) {
  const resolvedRepoPath = realpathSync(repoPath);
  const init = runGrape(repoPath, ["init", "--connect"]);
  assert(init.stdout.includes("grape mcp --install --client codex"), "init output must point to Codex MCP install");
  assert(init.stdout.includes("grape mcp --print-agents-snippet"), "init output must point to AGENTS snippet output");

  const dryRun = runGrape(repoPath, ["mcp", "--install", "--client", "codex", "--dry-run"]);
  assert(dryRun.stdout.includes("Dry run: no changes written."), "Codex install dry-run must not write config");
  assert(dryRun.stdout.includes("[mcp_servers.grape]"), "Codex install dry-run must print final TOML");
  assert(dryRun.stdout.includes("codex mcp add grape"), "Codex install dry-run must print codex mcp add fallback");
  assert(!existsSync(path.join(repoPath, ".codex", "config.toml")), "Codex dry-run must not create .codex/config.toml");

  mkdirSync(path.join(repoPath, ".codex"), { recursive: true });
  writeFileSync(path.join(repoPath, ".codex", "config.toml"), "[profile.default]\nmodel = \"gpt-5\"\n");
  const install = runGrape(repoPath, ["mcp", "--install", "--client", "codex"]);
  assert(
    install.stdout.includes("Grape MCP server config for Codex."),
    "Codex install must report successful config update"
  );

  const config = readFileSync(path.join(repoPath, ".codex", "config.toml"), "utf8");
  assert(config.includes("[profile.default]"), "Codex install must preserve unrelated TOML");
  assert(config.includes("[mcp_servers.grape]"), "Codex install must add Grape MCP table");
  assert(config.includes(`cwd = ${JSON.stringify(resolvedRepoPath)}`), "Codex install must pin the repository working directory");

  const repeat = runGrape(repoPath, ["mcp", "--install", "--client", "codex"]);
  assert(repeat.stdout.includes("already configured"), "repeated Codex install must be idempotent");

  const snippet = runGrape(repoPath, ["mcp", "--print-agents-snippet"]);
  assert(snippet.stdout.includes("call `grape_get_context`"), "AGENTS snippet must mention grape_get_context");
  assert(snippet.stdout.includes("`INVALIDATE_PREVIOUS`"), "AGENTS snippet must mention invalidation handling");
}

async function verifyGrapeMcpWorkflow(repoPath) {
  await runMcpContextRestoreSession({
    command: process.execPath,
    args: [distCli, "mcp", "--stdio", "--repo", repoPath],
    cwd: repoPath,
    env: envWithSqliteNodeOptions(),
    clientInfo: { name: "codex-local-workflow", version: sourcePackage.version },
    query: "codex local workflow",
    sessionId: "codex-local-workflow"
  });
}

function verifyPluginConfig() {
  const marketplace = readJson(path.join(root, ".agents", "plugins", "marketplace.json"));
  assert(marketplace.name === "grape-local", "Codex marketplace name must be grape-local");
  const entry = marketplace.plugins?.find((plugin) => plugin.name === "grape");
  assert(entry?.source?.path === "./plugins/grape", "Codex marketplace must point at ./plugins/grape");

  const mcp = readJson(path.join(root, "plugins", "grape", ".mcp.json"));
  const grapeServer = mcp.mcpServers?.grape;
  assert(grapeServer?.command === "grape", "Codex plugin MCP command must be grape");
  assert(grapeServer.args?.join("\0") === ["mcp", "--stdio"].join("\0"), "Codex plugin MCP args must run mcp --stdio");
}

function verifyCodexCliPluginWorkflow() {
  const codexVersion = spawnSync(commandForPlatform("codex"), ["--version"], spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    env: isolatedCodexEnv(),
    stdio: ["ignore", "pipe", "pipe"]
  }));
  if (isCodexUnavailable(codexVersion)) {
    console.log("codex CLI unavailable; skipped isolated Codex plugin install");
    return;
  }
  assert(codexVersion.status === 0, `codex --version failed: ${spawnFailureMessage(codexVersion)}`);

  const addMarketplace = runCodex(["plugin", "marketplace", "add", root, "--json"]);
  const addMarketplaceJson = JSON.parse(addMarketplace.stdout);
  assert(addMarketplaceJson.marketplaceName === "grape-local", "Codex marketplace add must return grape-local");

  const available = runCodex(["plugin", "list", "--marketplace", "grape-local", "--available", "--json"]);
  const availableJson = JSON.parse(available.stdout);
  assert(
    availableJson.available?.some((plugin) => plugin.pluginId === "grape@grape-local"),
    "Codex plugin list must expose grape@grape-local"
  );

  const install = runCodex(["plugin", "add", "grape@grape-local", "--json"]);
  const installJson = JSON.parse(install.stdout);
  assert(installJson.pluginId === "grape@grape-local", "Codex plugin add must install grape@grape-local");
}

function runGrape(repoPath, args) {
  const result = spawnSync(process.execPath, [distCli, ...args], spawnOptionsForPlatform({
    cwd: repoPath,
    encoding: "utf8",
    env: envWithSqliteNodeOptions(),
    maxBuffer: 16 * 1024 * 1024,
    shell: false
  }));
  assert(result.status === 0, `grape ${args.join(" ")} failed: ${spawnFailureMessage(result)}`);
  return result;
}

function runCodex(args) {
  const result = spawnSync(commandForPlatform("codex"), args, spawnOptionsForPlatform({
    cwd: root,
    encoding: "utf8",
    env: isolatedCodexEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024
  }));
  assert(result.status === 0, `codex ${args.join(" ")} failed: ${spawnFailureMessage(result)}`);
  return result;
}

function isolatedCodexEnv() {
  const home = path.join(codexHome, "home");
  const xdg = path.join(codexXdg, "xdg");
  const codexConfig = path.join(home, ".codex");
  mkdirSync(codexConfig, { recursive: true });
  mkdirSync(xdg, { recursive: true });
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: xdg,
    CODEX_HOME: codexConfig
  };
}

function isCodexUnavailable(result) {
  if (result.error?.code === "ENOENT") return true;
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`;
  return result.status !== 0 && /(not found|not recognized|no such file or directory|cannot find)/i.test(output);
}

function runGit(repoPath, args) {
  const result = spawnSync(commandForPlatform("git"), args, spawnOptionsForPlatform({
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  }));
  assert(result.status === 0, `git ${args.join(" ")} failed: ${spawnFailureMessage(result)}`);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
