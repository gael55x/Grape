import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pluginRoot = path.join(root, "plugins", "grape");
const marketplacePath = path.join(root, ".agents", "plugins", "marketplace.json");
const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
const mcpPath = path.join(pluginRoot, ".mcp.json");
const skillPath = path.join(pluginRoot, "skills", "grape", "SKILL.md");

for (const file of [marketplacePath, manifestPath, mcpPath, skillPath]) {
  assert(existsSync(file), `missing Codex plugin file: ${path.relative(root, file)}`);
}

const marketplace = readJson(marketplacePath);
assert(marketplace.name === "grape-local", "marketplace name must be grape-local");
assert(marketplace.interface?.displayName === "Grape Local", "marketplace display name must be Grape Local");
const entry = marketplace.plugins?.find((plugin) => plugin.name === "grape");
assert(entry, "marketplace must include grape plugin entry");
assert(entry.source?.source === "local", "marketplace grape source must be local");
assert(entry.source?.path === "./plugins/grape", "marketplace grape path must be ./plugins/grape");
assert(entry.policy?.installation === "AVAILABLE", "marketplace grape installation policy must be AVAILABLE");
assert(entry.policy?.authentication === "ON_INSTALL", "marketplace grape authentication policy must be ON_INSTALL");
assert(entry.category === "Productivity", "marketplace grape category must be Productivity");

const manifest = readJson(manifestPath);
assert(manifest.name === "grape", "plugin manifest name must be grape");
assert(manifest.version === "0.1.0", "plugin manifest version must be 0.1.0");
assert(manifest.skills === "./skills/", "plugin manifest must point at skills directory");
assert(manifest.mcpServers === "./.mcp.json", "plugin manifest must point at .mcp.json");
assert(!Object.hasOwn(manifest, "hooks"), "plugin manifest must not declare unsupported hooks");
assert(manifest.interface?.displayName === "Grape", "plugin display name must be Grape");
assert(manifest.interface?.category === "Engineering", "plugin interface category must be Engineering");
assert(Array.isArray(manifest.interface?.defaultPrompt), "plugin defaultPrompt must be an array");
assert(manifest.interface.defaultPrompt.length <= 3, "plugin defaultPrompt must have at most 3 entries");

const mcp = readJson(mcpPath);
const grapeServer = mcp.mcpServers?.grape;
assert(grapeServer?.command === "grape", "Grape MCP server command must be grape");
assert(Array.isArray(grapeServer.args), "Grape MCP server args must be an array");
assert(grapeServer.args.join("\0") === ["mcp", "--stdio"].join("\0"), "Grape MCP server args must run mcp --stdio");

const skill = readFileSync(skillPath, "utf8");
assert(skill.includes("name: grape"), "Grape skill must declare name");
assert(skill.includes("grape_get_context"), "Grape skill must tell Codex to call grape_get_context");
assert(skill.includes("INVALIDATE_PREVIOUS"), "Grape skill must explain invalidation");
assert(skill.includes("not a code graph replacement"), "Grape skill must avoid graph replacement positioning");
assert(!skill.includes("[TODO:"), "Grape skill must not include TODO placeholders");

console.log("codex plugin ok");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
