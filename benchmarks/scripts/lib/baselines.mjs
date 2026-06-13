import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { envWithSqliteNodeOptions } from "../../../scripts/sqlite-node-env.mjs";
import { sanitizeReportText } from "./sanitize-paths.mjs";
import { spawnInstalledGrape } from "./tarball-install.mjs";
import { estimateTokens } from "./tokens.mjs";
import { repoRoot } from "./environment.mjs";

export function loadPostBetaManifest(root = repoRoot()) {
  return JSON.parse(readFileSync(path.join(root, "benchmarks/fixtures/manifest.json"), "utf8"));
}

export function caseBudgetBytes(manifest, caseDef) {
  return caseDef.budgetBytes ?? manifest.defaultBudgetBytes?.[caseDef.id] ?? 32768;
}

export function prepareCaseRepo(caseDef, root = repoRoot()) {
  if (caseDef.repoKind === "grape-docs-slice") {
    return prepareDocsSliceRepo(caseDef, root);
  }
  return prepareFixtureRepo(caseDef.fixtureName, root);
}

function prepareFixtureRepo(fixtureName, root) {
  const fixturePath = path.join(root, "tests/fixtures", fixtureName);
  if (!existsSync(fixturePath)) {
    throw new Error(`fixture not found: ${fixtureName}`);
  }

  const workspacePath = mkdtempSync(path.join(tmpdir(), "grape-bench-post-beta-"));
  const repoPath = path.join(workspacePath, fixtureName);
  cpSync(fixturePath, repoPath, {
    recursive: true,
    filter: (source) => shouldCopyFixturePath(fixturePath, source)
  });

  execGit(repoPath, ["init", "-b", "main"]);
  execGit(repoPath, ["add", "."]);
  execGit(repoPath, [
    "-c",
    "user.name=Grape Benchmark",
    "-c",
    "user.email=benchmark@grape.local",
    "commit",
    "-m",
    "post-beta benchmark fixture"
  ]);

  return {
    repoPath,
    workspacePath,
    cleanup() {
      rmSync(workspacePath, { recursive: true, force: true });
    }
  };
}

function prepareDocsSliceRepo(caseDef, root) {
  const workspacePath = mkdtempSync(path.join(tmpdir(), "grape-bench-post-beta-"));
  const repoPath = path.join(workspacePath, "grape-docs-slice");

  for (const relativePath of caseDef.docsSlicePaths ?? []) {
    const sourcePath = path.join(root, relativePath);
    if (!existsSync(sourcePath)) continue;
    const targetPath = path.join(repoPath, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }

  execGit(repoPath, ["init", "-b", "main"]);
  execGit(repoPath, ["add", "."]);
  execGit(repoPath, [
    "-c",
    "user.name=Grape Benchmark",
    "-c",
    "user.email=benchmark@grape.local",
    "commit",
    "-m",
    "post-beta docs slice"
  ]);

  return {
    repoPath,
    workspacePath,
    cleanup() {
      rmSync(workspacePath, { recursive: true, force: true });
    }
  };
}

function shouldCopyFixturePath(rootPath, sourcePath) {
  const relativePath = path.relative(rootPath, sourcePath);
  if (relativePath === "") return true;
  if (relativePath === "grape-fixture.json") return false;
  const segments = relativePath.split(path.sep);
  if (segments.includes(".git") || segments.includes("node_modules")) return false;
  if (segments[0] !== ".grape") return true;
  const localStateName = segments[1];
  if (!localStateName) return true;
  if (localStateName === "grape.db" || localStateName === "artifacts" || localStateName === "config.json") {
    return false;
  }
  return !localStateName.startsWith("config.invalid.");
}

function execGit(repoPath, args) {
  execFileSync("git", args, { cwd: repoPath, encoding: "utf8" });
}

export function collectNaiveFiles(repoPath) {
  const selected = [];
  const pushIfFile = (relativePath) => {
    const absolutePath = path.join(repoPath, relativePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) return;
    if (!selected.includes(relativePath)) selected.push(relativePath);
  };

  for (const name of readdirSync(repoPath)) {
    if (name.startsWith("README")) pushIfFile(name);
  }
  pushIfFile("package.json");
  pushIfFile("ROADMAP.md");
  pushIfFile("CHANGELOG.md");
  pushIfFile("benchmarks/README.md");

  walkRepo(repoPath, repoPath, (relativePath) => {
    if (relativePath.includes("node_modules") || relativePath.includes(".git/")) return;
    const base = path.basename(relativePath);
    if (relativePath.startsWith("docs/") && relativePath.endsWith(".md")) {
      pushIfFile(relativePath);
      return;
    }
    if (relativePath.startsWith("packages/") && base === "package.json") {
      pushIfFile(relativePath);
      return;
    }
    if (/\.(test|spec)\.(ts|js)$/.test(base)) {
      pushIfFile(relativePath);
      return;
    }
    if (relativePath.startsWith("src/") && /\.(ts|js)$/.test(base) && !/\.(test|spec)\./.test(base)) {
      pushIfFile(relativePath);
    }
  });

  return selected.sort();
}

function walkRepo(rootPath, currentPath, visit) {
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join("/");
    if (entry.isDirectory()) {
      walkRepo(rootPath, absolutePath, visit);
    } else if (entry.isFile()) {
      visit(relativePath);
    }
  }
}

export function assemblePayload(repoPath, files, budgetMode, budgetBytes) {
  const ordered = [...files].sort();
  let text = "";
  const selected = [];

  for (const file of ordered) {
    const absolutePath = path.join(repoPath, file);
    if (!existsSync(absolutePath)) continue;
    const chunk = readFileSync(absolutePath, "utf8");
    const separator = text.length > 0 ? "\n" : "";
    const next = `${separator}/* ${file} */\n${chunk}`;
    if (budgetMode === "budgeted" && Buffer.byteLength(text + next, "utf8") > budgetBytes) {
      const remaining = budgetBytes - Buffer.byteLength(text, "utf8");
      if (remaining > 0) {
        text += next.slice(0, remaining);
        selected.push(file);
      }
      break;
    }
    text += next;
    selected.push(file);
  }

  return {
    files: selected,
    text,
    contextBytes: Buffer.byteLength(text, "utf8"),
    estimatedTokens: estimateTokens(text)
  };
}

export function runSearchBaseline(repoPath, caseDef, budgetMode, budgetBytes, resolvedEngine = null) {
  const engine = resolvedEngine ?? resolveSearchEngine();

  if (engine.searchEngine === "node-fallback") {
    return runNodeSearchFallback(repoPath, caseDef, budgetMode, budgetBytes);
  }

  const matched = new Set();
  for (const query of caseDef.searchQueries ?? []) {
    try {
      const output = execFileSync(engine.binary, ["-l", query, repoPath], { encoding: "utf8" }).trim();
      for (const absolutePath of output.split("\n").filter(Boolean)) {
        matched.add(path.relative(repoPath, absolutePath).split(path.sep).join("/"));
      }
    } catch (error) {
      if (error.status === 1) continue;
      throw error;
    }
  }

  const files = [...matched].sort();
  const payload = assemblePayload(repoPath, files, budgetMode, budgetBytes);
  return { ...payload, searchEngine: "rg" };
}

function runNodeSearchFallback(repoPath, caseDef, budgetMode, budgetBytes) {
  const queries = caseDef.searchQueries ?? [];
  const matched = new Set();

  if (queries.length > 0) {
    const normalizedQueries = queries.map((q) => q.toLowerCase());
    walkRepo(repoPath, repoPath, (relativePath) => {
      const absolutePath = path.join(repoPath, relativePath);
      try {
        const content = readFileSync(absolutePath, "utf8");
        const lower = content.toLowerCase();
        if (normalizedQueries.some((q) => lower.includes(q))) {
          matched.add(relativePath);
        }
      } catch {
        // skip unreadable or binary files
      }
    });
  }

  const files = [...matched].sort();
  const payload = assemblePayload(repoPath, files, budgetMode, budgetBytes);
  return { ...payload, searchEngine: "node-fallback" };
}

export function resolveRgBinary() {
  const candidates = ["rg", "/opt/homebrew/bin/rg", "/usr/local/bin/rg"];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { encoding: "utf8" });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error("ripgrep (rg) is required for the search baseline but was not found on PATH");
}

export function resolveSearchEngine() {
  try {
    const binary = resolveRgBinary();
    return { searchEngine: "rg", binary };
  } catch {
    return { searchEngine: "node-fallback", binary: null };
  }
}

export function runNaiveBaseline(repoPath, budgetMode, budgetBytes) {
  const files = collectNaiveFiles(repoPath);
  return assemblePayload(repoPath, files, budgetMode, budgetBytes);
}

export function runGrapeBaseline({ grapeCli, repoPath, caseDef, budgetMode, budgetBytes, root }) {
  const sessionId = `bench-post-beta-${caseDef.id}`;
  const init = spawnInstalledGrape(
    grapeCli,
    ["init", "--connect", "--repo", repoPath],
    { root, cwd: repoPath }
  );
  if (init.status !== 0) {
    throw new Error(sanitizeReportText(init.stderr?.trim() || init.stdout?.trim() || "grape init failed", root));
  }

  const compileArgs = [
    "compile",
    "--task",
    caseDef.targetTask,
    "--session",
    sessionId,
    "--json",
    "--repo",
    repoPath
  ];
  if (budgetMode === "budgeted") {
    compileArgs.push("--token-budget", String(Math.max(1, Math.floor(budgetBytes / 4))));
  }

  const compile = spawnInstalledGrape(grapeCli, compileArgs, { root, cwd: repoPath });
  if (compile.status !== 0) {
    throw new Error(sanitizeReportText(compile.stderr?.trim() || compile.stdout?.trim() || "grape compile failed", root));
  }

  const output = JSON.parse(compile.stdout);
  const layers = extractGrapeRefLayers(output);
  const files = layers.finalAgentFacingRefs;
  const layeredMetrics = buildLayerMetrics(layers, caseDef);
  const payloadText = compile.stdout;
  let contextBytes = Buffer.byteLength(payloadText, "utf8");
  if (budgetMode === "budgeted" && contextBytes > budgetBytes) {
    contextBytes = budgetBytes;
  }

  const spanDiagnostics = evaluateSpanChecks(caseDef, output, repoPath);
  return {
    files,
    layers,
    layeredMetrics,
    text: payloadText,
    contextBytes,
    estimatedTokens: estimateTokens(payloadText),
    compileOutput: output,
    ...spanDiagnostics
  };
}

export function extractGrapeFiles(compileOutput, _repoPath) {
  return extractGrapeRefLayers(compileOutput).finalAgentFacingRefs;
}

export function extractGrapeRefLayers(compileOutput) {
  const retrievalRefs = new Set();
  const evidenceRefs = new Set();
  const projectRuleRefs = new Set();
  const packInputRefs = new Set();

  const artifact = compileOutput.contextArtifact;
  if (artifact?.outputSections) {
    for (const section of artifact.outputSections) {
      if (section.id === "task-retrieval") {
        collectSectionRefs(section, retrievalRefs);
      } else if (section.id === "exact-source-evidence") {
        collectSectionRefs(section, evidenceRefs);
      } else if (section.id === "active-project-rules") {
        collectSectionRefs(section, projectRuleRefs);
      }
    }
  }

  for (const item of compileOutput.contextPackItems ?? []) {
    for (const inputRef of item.inputRefs ?? []) {
      if (inputRef.ref) {
        const normalized = normalizeToRepoFile(inputRef.ref);
        if (isRepoFilePath(normalized)) packInputRefs.add(normalized);
      }
    }
  }

  const finalRefs = new Set([...retrievalRefs, ...evidenceRefs, ...projectRuleRefs]);

  return {
    retrievalSelectedRefs: [...retrievalRefs].sort(),
    evidenceRefs: [...evidenceRefs].sort(),
    projectRuleRefs: [...projectRuleRefs].sort(),
    packInputRefs: [...packInputRefs].sort(),
    finalAgentFacingRefs: [...finalRefs].sort()
  };
}

function collectSectionRefs(section, target) {
  for (const sourceRef of section.sourceRefs ?? []) {
    addRepoFilePath(target, sourceRef);
  }
  for (const itemRef of section.itemRefs ?? []) {
    if (itemRef.ref) addRepoFilePath(target, itemRef.ref);
  }
  if (section.id === "task-retrieval" && section.text) {
    for (const line of section.text.split("\n")) {
      const match = /^- (.+)$/.exec(line.trim());
      if (match) addRepoFilePath(target, match[1]);
    }
  }
}

export function buildLayerMetrics(layers, caseDef) {
  const result = {};
  for (const [layerName, files] of Object.entries(layers)) {
    const classification = classifySelection(files, caseDef);
    result[layerName] = {
      actualFilesSelected: classification.actualFilesSelected,
      selectedCount: classification.actualFilesSelected.length,
      relevanceRecall: classification.relevanceRecall,
      knownNoiseRatio: classification.knownNoiseRatio,
      knownIrrelevantFilesSelected: classification.knownIrrelevantFilesSelected
    };
  }
  return result;
}

function addRepoFilePath(files, rawValue) {
  const normalized = normalizeToRepoFile(rawValue);
  if (!isRepoFilePath(normalized)) return;
  files.add(normalized);
}

function normalizeToRepoFile(value) {
  let candidate = value.trim().split(" ")[0];
  const spanMatch = /^(.+?):(\d+-\d+)/.exec(candidate);
  if (spanMatch) {
    candidate = spanMatch[1];
  }
  return normalizeRepoRelativePath(candidate);
}

function isRepoFilePath(value) {
  const candidate = value.trim();
  if (!candidate || candidate === "none") return false;
  if (/^(claim|proof|symbol|compression|snapshot|symbol_edge):/.test(candidate)) return false;
  if (candidate.includes(" score=") || candidate.includes(" signals=")) return false;
  if (candidate.includes(" imports ") || candidate.includes(" calls ")) return false;
  if (candidate.includes("(advisory ranking signal")) return false;

  return (
    /^[\w./@-]+\.(ts|js|md|json|ya?ml|toml)$/i.test(candidate) ||
    candidate === "README.md" ||
    candidate.endsWith("/README.md") ||
    candidate.endsWith("/package.json") ||
    candidate === "ROADMAP.md" ||
    candidate === "CHANGELOG.md"
  );
}

function normalizeRepoRelativePath(value) {
  return value.split(path.sep).join("/");
}

export function evaluateSpanChecks(caseDef, compileOutput, repoPath) {
  const actualSpanHits = [];
  let proofOrEvidencePresent = false;
  let taskRetrievalSectionPresent = false;

  const artifact = compileOutput.contextArtifact;
  if (artifact?.outputSections) {
    for (const section of artifact.outputSections) {
      if (section.id === "task-retrieval") taskRetrievalSectionPresent = true;
      if (section.id === "exact-source-evidence" || section.type === "proof") {
        proofOrEvidencePresent = true;
      }
      const body = section.text ?? "";
      for (const expected of caseDef.expectedSpans ?? []) {
        if (section.sourceRefs?.includes(expected.file) || section.itemRefs?.some((ref) => ref.ref === expected.file)) {
          if (body.includes(expected.contains)) {
            actualSpanHits.push({ file: expected.file, contains: expected.contains, hit: true });
          }
        }
      }
    }
  }

  for (const expected of caseDef.expectedSpans ?? []) {
    const absolutePath = path.join(repoPath, expected.file);
    if (!existsSync(absolutePath)) continue;
    const sourceText = readFileSync(absolutePath, "utf8");
    const alreadyHit = actualSpanHits.some(
      (hit) => hit.file === expected.file && hit.contains === expected.contains && hit.hit
    );
    if (!alreadyHit && sourceText.includes(expected.contains)) {
      const sectionHit = artifact?.outputSections?.some(
        (section) =>
          (section.sourceRefs?.includes(expected.file) ||
            section.itemRefs?.some((ref) => ref.ref === expected.file)) &&
          (section.text ?? "").includes(expected.contains)
      );
      actualSpanHits.push({
        file: expected.file,
        contains: expected.contains,
        hit: Boolean(sectionHit)
      });
    }
  }

  return {
    expectedSpans: caseDef.expectedSpans ?? [],
    actualSpanHits,
    proofOrEvidencePresent,
    taskRetrievalSectionPresent
  };
}

export function isKnownIrrelevant(file, caseDef) {
  const normalized = file.split(path.sep).join("/");
  if ((caseDef.knownIrrelevantFiles ?? []).includes(normalized)) return true;
  for (const prefix of caseDef.knownIrrelevantPrefixes ?? []) {
    if (normalized.startsWith(prefix)) return true;
  }
  return false;
}

export function classifySelection(selectedFiles, caseDef) {
  const expected = caseDef.expectedRelevantFiles ?? [];
  const expectedSet = new Set(expected);
  const actualFilesSelected = [...new Set(selectedFiles)].sort();
  const expectedFilesFound = expected.filter((file) => actualFilesSelected.includes(file));
  const knownIrrelevantFilesSelected = actualFilesSelected.filter((file) => isKnownIrrelevant(file, caseDef));
  const neutralFilesSelected = actualFilesSelected.filter(
    (file) => !expectedSet.has(file) && !isKnownIrrelevant(file, caseDef)
  );

  const totalSelected = actualFilesSelected.length;
  const expectedFilesMissedCount = expected.length - expectedFilesFound.length;

  return {
    expectedRelevantFiles: expected,
    actualFilesSelected,
    expectedFilesFoundCount: expectedFilesFound.length,
    expectedFilesMissedCount,
    knownIrrelevantFilesSelected,
    knownIrrelevantFilesSelectedCount: knownIrrelevantFilesSelected.length,
    neutralFilesSelected,
    neutralFilesSelectedCount: neutralFilesSelected.length,
    relevanceRecall: expected.length === 0 ? null : expectedFilesFound.length / expected.length,
    knownNoiseRatio: totalSelected === 0 ? null : knownIrrelevantFilesSelected.length / totalSelected
  };
}

export function buildBaselineRow({
  caseDef,
  baselineName,
  inputSource,
  packageVersion,
  budgetMode,
  budgetBytes,
  payload,
  runtimeMs,
  errorCount,
  notes,
  extra = {}
}) {
  const classification = classifySelection(payload.files ?? [], caseDef);
  return {
    caseId: caseDef.id,
    caseName: caseDef.name,
    targetTask: caseDef.targetTask,
    baselineName,
    inputSource,
    packageVersion,
    budgetMode,
    ...(budgetMode === "budgeted" ? { budgetBytes } : {}),
    ...classification,
    contextBytes: payload.contextBytes ?? 0,
    estimatedTokens: payload.estimatedTokens ?? 0,
    runtimeMs,
    errorCount,
    notes,
    ...extra
  };
}

export function compareBeforeAfter(publishedResult, localResult) {
  const beforeIdentity = publishedResult?.environment?.artifactIdentity;
  const afterIdentity = localResult?.environment?.artifactIdentity;

  if (!beforeIdentity || !afterIdentity) {
    return {
      valid: false,
      reason: "Missing artifactIdentity on one or both result files."
    };
  }

  if (beforeIdentity === afterIdentity) {
    return {
      valid: false,
      reason:
        "No valid before and after comparison was produced because both runs used the same artifact identity."
    };
  }

  if (publishedResult.environment?.artifactMode !== "published-beta") {
    return { valid: false, reason: "Before result is not published-beta." };
  }
  if (localResult.environment?.artifactMode !== "local-candidate") {
    return { valid: false, reason: "After result is not local-candidate." };
  }

  return {
    valid: true,
    beforeArtifactIdentity: beforeIdentity,
    afterArtifactIdentity: afterIdentity,
    caseComparisons: buildCaseComparisons(publishedResult, localResult)
  };
}

function buildCaseComparisons(publishedResult, localResult) {
  const comparisons = [];
  for (const caseDef of publishedResult.cases ?? []) {
    const afterCase = (localResult.cases ?? []).find((entry) => entry.caseId === caseDef.caseId);
    if (!afterCase) continue;

    comparisons.push({
      caseId: caseDef.caseId,
      budgetModes: ["uncapped", "budgeted"].map((budgetMode) => {
        const beforeGrape = findRow(caseDef.rows, "grape", budgetMode);
        const afterGrape = findRow(afterCase.rows, "grape", budgetMode);
        return {
          budgetMode,
          publishedBeta: metricSnapshot(beforeGrape),
          localCandidate: metricSnapshot(afterGrape)
        };
      })
    });
  }
  return comparisons;
}

function findRow(rows, baselineName, budgetMode) {
  return rows?.find((row) => row.baselineName === baselineName && row.budgetMode === budgetMode);
}

function metricSnapshot(row) {
  if (!row) return null;
  const snapshot = {
    relevanceRecall: row.relevanceRecall,
    knownNoiseRatio: row.knownNoiseRatio,
    contextBytes: row.contextBytes,
    expectedFilesFoundCount: row.expectedFilesFoundCount,
    knownIrrelevantFilesSelectedCount: row.knownIrrelevantFilesSelectedCount
  };
  if (row.layers) {
    snapshot.layerKnownNoiseRatios = Object.fromEntries(
      Object.entries(row.layers).map(([name, layer]) => [name, layer.knownNoiseRatio])
    );
  }
  return snapshot;
}

const LAYER_ORDER = [
  "retrievalSelectedRefs",
  "evidenceRefs",
  "projectRuleRefs",
  "packInputRefs",
  "finalAgentFacingRefs"
];

const LAYER_COMPONENT_NAMES = {
  retrievalSelectedRefs: "task retrieval selection",
  evidenceRefs: "exact source evidence attachment",
  projectRuleRefs: "project rule selection",
  packInputRefs: "compiler source manifest selection",
  finalAgentFacingRefs: "final context compilation"
};

function resolveFirstNoisyLayer(layers) {
  if (!layers) return { firstNoisyLayer: "unknown", likelyComponent: "ranking or selection cap" };
  for (const layerName of LAYER_ORDER) {
    const layer = layers[layerName];
    if (layer && (layer.knownIrrelevantFilesSelected?.length ?? 0) > 0) {
      return { firstNoisyLayer: layerName, likelyComponent: LAYER_COMPONENT_NAMES[layerName] };
    }
  }
  return { firstNoisyLayer: "none", likelyComponent: "none" };
}

export function attributeComponents(rows) {
  const attributions = [];
  for (const row of rows.filter((entry) => entry.baselineName === "grape")) {
    if (row.errorCount > 0) {
      attributions.push({
        symptom: "Grape baseline failed to compile",
        affectedCase: row.caseId,
        likelyComponent: "package install and CLI discovery",
        evidence: row.notes,
        fixNow: false
      });
      continue;
    }

    if (row.expectedFilesMissedCount > 0) {
      const searchRow = rows.find(
        (entry) =>
          entry.caseId === row.caseId &&
          entry.baselineName === "search" &&
          entry.budgetMode === row.budgetMode &&
          entry.expectedFilesFoundCount > row.expectedFilesFoundCount
      );
      attributions.push({
        symptom: `Missed ${row.expectedFilesMissedCount} expected file(s)`,
        affectedCase: row.caseId,
        likelyComponent: searchRow
          ? "semantic candidate retrieval or ranking"
          : "file indexing",
        evidence: `Grape found ${row.expectedFilesFoundCount}/${row.expectedRelevantFiles.length}; search found ${searchRow?.expectedFilesFoundCount ?? "n/a"}`,
        fixNow: Boolean(searchRow),
        budgetMode: row.budgetMode
      });
    }

    if ((row.knownIrrelevantFilesSelectedCount ?? 0) > 0) {
      const { firstNoisyLayer, likelyComponent } = resolveFirstNoisyLayer(row.layers);
      attributions.push({
        symptom: "Selected known-irrelevant files",
        affectedCase: row.caseId,
        likelyComponent,
        firstNoisyLayer,
        evidence: row.knownIrrelevantFilesSelected.join(", "),
        fixNow: true,
        budgetMode: row.budgetMode
      });
    }

    if (row.taskRetrievalSectionPresent === false) {
      attributions.push({
        symptom: "Missing task-retrieval section",
        affectedCase: row.caseId,
        likelyComponent: "semantic candidate retrieval",
        evidence: "taskRetrievalSectionPresent=false",
        fixNow: true,
        budgetMode: row.budgetMode
      });
    }
  }
  return attributions;
}
