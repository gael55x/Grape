import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type BootstrapConfidence = "high" | "medium" | "low" | "unknown";

export interface LocalBootstrapDetection {
  readonly languages: readonly string[];
  readonly frameworks: readonly string[];
  readonly packageManager?: string;
  readonly scripts: readonly string[];
  readonly commands: readonly string[];
  readonly testCommand?: string;
  readonly entryPoints: readonly string[];
  readonly configFiles: readonly string[];
  readonly candidateRules: readonly string[];
  readonly confidence: {
    readonly language: BootstrapConfidence;
    readonly framework: BootstrapConfidence;
    readonly packageManager: BootstrapConfidence;
    readonly testCommand: BootstrapConfidence;
  };
  readonly warnings: readonly string[];
}

interface PackageJsonShape {
  readonly packageManager?: string;
  readonly scripts?: Record<string, unknown>;
  readonly dependencies?: Record<string, unknown>;
  readonly devDependencies?: Record<string, unknown>;
}

const lockfilePackageManagers = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"]
] as const;

const knownScriptOrder = ["dev", "start", "build", "test", "test:unit", "lint", "typecheck"] as const;

const rootConfigCandidates = [
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "vitest.config.ts",
  "vitest.config.js",
  "jest.config.js",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  ...lockfilePackageManagers.map(([lockfile]) => lockfile)
] as const;

const entryPointCandidates = [
  "src/index.ts",
  "src/main.ts",
  "src/app.ts",
  "src/server.ts",
  "src/index.js",
  "src/main.js",
  "app/page.tsx",
  "pages/index.tsx",
  "index.js",
  "main.py"
] as const;

export function detectLocalBootstrap(rootPath: string): LocalBootstrapDetection {
  const packageResult = readPackageJson(rootPath);
  const packageJson = packageResult.packageJson;
  const configFiles = existingFiles(rootPath, rootConfigCandidates);
  const entryPoints = existingFiles(rootPath, entryPointCandidates);
  const packageManager = detectPackageManager(rootPath, packageJson);
  const scripts = scriptNames(packageJson);
  const commands = scripts.map((script) => scriptCommand(packageManager ?? "npm", script));
  const testCommand = commandForFirstScript(packageManager ?? "npm", scripts, ["test", "test:unit"]);
  const languages = detectLanguages(rootPath, packageJson, configFiles);
  const frameworks = detectFrameworks(rootPath, packageJson, configFiles);

  return {
    languages,
    frameworks,
    packageManager,
    scripts,
    commands,
    testCommand,
    entryPoints,
    configFiles,
    candidateRules: candidateRules({ testCommand, entryPoints, scripts, packageManager }),
    confidence: {
      language: languages.length > 0 ? "medium" : "unknown",
      framework: frameworks.length > 0 ? "medium" : packageJson ? "low" : "unknown",
      packageManager: packageManager ? (hasLockfile(rootPath) ? "high" : "medium") : "unknown",
      testCommand: testCommand ? "high" : "unknown"
    },
    warnings: packageResult.warning ? [packageResult.warning] : []
  };
}

function readPackageJson(rootPath: string): { readonly packageJson?: PackageJsonShape; readonly warning?: string } {
  const packageJsonPath = path.join(rootPath, "package.json");
  if (!existsSync(packageJsonPath)) return {};

  try {
    return { packageJson: JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonShape };
  } catch {
    return { warning: "package_json_unreadable" };
  }
}

function detectPackageManager(rootPath: string, packageJson: PackageJsonShape | undefined): string | undefined {
  for (const [lockfile, packageManager] of lockfilePackageManagers) {
    if (existsSync(path.join(rootPath, lockfile))) return packageManager;
  }

  const packageManager = packageJson?.packageManager;
  if (typeof packageManager === "string" && packageManager.length > 0) {
    return packageManager.split("@")[0];
  }

  return packageJson ? "npm" : undefined;
}

function scriptNames(packageJson: PackageJsonShape | undefined): string[] {
  const scripts = packageJson?.scripts;
  if (!scripts) return [];

  const names = Object.keys(scripts).filter((name) => typeof scripts[name] === "string");
  const prioritized = knownScriptOrder.filter((name) => names.includes(name));
  const prioritizedSet = new Set<string>(prioritized);
  const remaining = names.filter((name) => !prioritizedSet.has(name)).sort();
  return [...prioritized, ...remaining].slice(0, 12);
}

function detectLanguages(
  rootPath: string,
  packageJson: PackageJsonShape | undefined,
  configFiles: readonly string[]
): string[] {
  const languages = new Set<string>();
  if (configFiles.some((file) => file === "tsconfig.json") || hasDependency(packageJson, "typescript")) {
    languages.add("TypeScript");
  }
  if (packageJson) languages.add("JavaScript");
  if (configFiles.some((file) => file === "pyproject.toml" || file === "requirements.txt")) {
    languages.add("Python");
  }
  if (existsSync(path.join(rootPath, "go.mod"))) languages.add("Go");
  if (existsSync(path.join(rootPath, "Cargo.toml"))) languages.add("Rust");
  return [...languages];
}

function detectFrameworks(
  rootPath: string,
  packageJson: PackageJsonShape | undefined,
  configFiles: readonly string[]
): string[] {
  const frameworks = new Set<string>();
  if (hasDependency(packageJson, "next") || configFiles.some((file) => file.startsWith("next.config."))) {
    frameworks.add("Next.js");
  }
  if (hasDependency(packageJson, "vite") || configFiles.some((file) => file.startsWith("vite.config."))) {
    frameworks.add("Vite");
  }
  if (hasDependency(packageJson, "react")) frameworks.add("React");
  if (hasDependency(packageJson, "vue")) frameworks.add("Vue");
  if (hasDependency(packageJson, "svelte")) frameworks.add("Svelte");
  if (hasDependency(packageJson, "express")) frameworks.add("Express");
  if (hasDependency(packageJson, "tailwindcss") || configFiles.some((file) => file.startsWith("tailwind.config."))) {
    frameworks.add("Tailwind CSS");
  }
  if (hasDependency(packageJson, "vitest") || configFiles.some((file) => file.startsWith("vitest.config."))) {
    frameworks.add("Vitest");
  }
  if (hasDependency(packageJson, "jest") || configFiles.some((file) => file.startsWith("jest.config."))) {
    frameworks.add("Jest");
  }
  if (existsSync(path.join(rootPath, "pyproject.toml"))) frameworks.add("Python project");
  return [...frameworks];
}

function hasDependency(packageJson: PackageJsonShape | undefined, dependencyName: string): boolean {
  return Boolean(packageJson?.dependencies?.[dependencyName] ?? packageJson?.devDependencies?.[dependencyName]);
}

function existingFiles(rootPath: string, candidates: readonly string[]): string[] {
  return candidates.filter((candidate) => existsSync(path.join(rootPath, candidate)));
}

function hasLockfile(rootPath: string): boolean {
  return lockfilePackageManagers.some(([lockfile]) => existsSync(path.join(rootPath, lockfile)));
}

function commandForFirstScript(
  packageManager: string,
  scripts: readonly string[],
  candidates: readonly string[]
): string | undefined {
  const script = candidates.find((candidate) => scripts.includes(candidate));
  return script ? scriptCommand(packageManager, script) : undefined;
}

function scriptCommand(packageManager: string, script: string): string {
  if (packageManager === "npm") return script === "start" ? "npm start" : `npm run ${script}`;
  if (packageManager === "yarn") return `yarn ${script}`;
  if (packageManager === "pnpm") return `pnpm ${script}`;
  if (packageManager === "bun") return `bun run ${script}`;
  return `${packageManager} run ${script}`;
}

function candidateRules(input: {
  readonly testCommand?: string;
  readonly entryPoints: readonly string[];
  readonly scripts: readonly string[];
  readonly packageManager?: string;
}): string[] {
  const rules = ["Do not edit generated or ignored files without explicit instruction."];
  if (input.entryPoints.length > 0) {
    rules.unshift("Follow existing source entry points before adding new top-level structure.");
  }
  if (input.testCommand) {
    rules.unshift(`Run ${input.testCommand} before final changes when behavior changes.`);
  }
  if (input.packageManager && input.scripts.includes("lint")) {
    rules.push(`Use ${scriptCommand(input.packageManager, "lint")} when editing linted source.`);
  }
  return rules;
}
