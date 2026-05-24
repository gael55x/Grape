import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, "src");

function listTypeScriptFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(fullPath) {
  return path.relative(repoRoot, fullPath).split(path.sep).join("/");
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    resolved,
    resolved.replace(/\.js$/, ".ts"),
    `${resolved}.ts`,
    path.join(resolved, "index.ts")
  ];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return resolved.replace(/\.js$/, ".ts");
}

function layerOf(repoPath) {
  if (repoPath === "src/index.ts") return "root";
  if (repoPath.startsWith("src/shared/")) return "shared";
  if (repoPath.startsWith("src/cli/")) return "cli";
  if (repoPath.startsWith("src/mcp/")) return "mcp";
  if (repoPath.startsWith("src/app/")) return "app";
  if (repoPath.startsWith("src/core/")) {
    const [, , domain] = repoPath.split("/");
    return `core/${domain}`;
  }
  if (repoPath.startsWith("src/")) return "src";
  if (repoPath.startsWith("tests/")) return "tests";
  if (repoPath.startsWith("scripts/")) return "scripts";
  return "outside";
}

function coreDomain(layer) {
  return layer.startsWith("core/") ? layer.slice("core/".length) : null;
}

const allowedCoreDomainImports = {
  state: [],
  evidence: ["state", "security", "storage"],
  trust: ["claims", "proofs", "scope"],
  claims: ["proofs", "scope"],
  proofs: ["evidence", "security"],
  scope: ["git"],
  retrieval: ["claims", "scope", "indexing"],
  compiler: ["retrieval", "compression", "security"],
  compression: ["security", "storage"],
  diff: ["sessions", "compiler"],
  sessions: ["storage"],
  storage: [],
  git: [],
  indexing: ["git", "security", "storage"],
  security: []
};

function isAllowedImport(fromLayer, toLayer) {
  if (toLayer === "outside") return false;
  if (toLayer === "tests" || toLayer === "scripts") return false;
  if (fromLayer === toLayer) return true;

  if (fromLayer === "root") {
    return toLayer === "shared" || toLayer.startsWith("core/");
  }

  if (fromLayer === "shared") {
    return toLayer === "shared";
  }

  if (fromLayer === "cli" || fromLayer === "mcp") {
    return toLayer === fromLayer || toLayer === "app" || toLayer === "shared";
  }

  if (fromLayer === "app") {
    return toLayer === "app" || toLayer === "shared" || toLayer.startsWith("core/");
  }

  if (fromLayer.startsWith("core/")) {
    if (toLayer === "shared") return true;
    if (!toLayer.startsWith("core/")) return false;

    const fromDomain = coreDomain(fromLayer);
    const toDomain = coreDomain(toLayer);

    if (fromDomain === toDomain) return true;
    return allowedCoreDomainImports[fromDomain]?.includes(toDomain) ?? false;
  }

  return false;
}

const specifierPattern =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

const violations = [];

for (const file of listTypeScriptFiles(srcRoot)) {
  const source = readFileSync(file, "utf8");
  const fromRepoPath = toRepoPath(file);
  const fromLayer = layerOf(fromRepoPath);

  for (const match of source.matchAll(specifierPattern)) {
    const specifier = match[1];
    const target = resolveImport(file, specifier);
    if (!target) continue;

    const targetRepoPath = toRepoPath(target);
    const toLayer = layerOf(targetRepoPath);

    if (!isAllowedImport(fromLayer, toLayer)) {
      violations.push(`${fromRepoPath} imports ${targetRepoPath} (${fromLayer} -> ${toLayer})`);
    }
  }
}

if (violations.length > 0) {
  console.error("architecture boundary violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("architecture boundaries ok");
