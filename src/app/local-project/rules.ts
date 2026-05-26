import path from "node:path";

import { collectRepoSnapshotEvidence } from "../../core/evidence/index.js";
import { createGitRepoSnapshot } from "../../core/git/index.js";
import { scanArtifactTextForSecrets } from "../../core/security/index.js";
import type { SourceRecord } from "../../core/storage/index.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";
import { readLocalSourceExcerpts } from "./source-excerpts.js";

export interface LocalRuleSummary {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly proofId: string;
  readonly excerptHash: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
  readonly body: string;
}

export interface ListLocalRulesInput {
  readonly rootPath: string;
  readonly now?: string;
  readonly gitBinary?: string;
}

export interface ListLocalRulesResult {
  readonly rootPath: string;
  readonly branch: string;
  readonly headCommit: string;
  readonly dirtyWorktree: boolean;
  readonly rules: readonly LocalRuleSummary[];
  readonly rejectedRuleRefs: readonly string[];
  readonly warnings: readonly string[];
}

export function listLocalRules(input: ListLocalRulesInput): ListLocalRulesResult {
  const rootPath = path.resolve(input.rootPath);
  const snapshot = createGitRepoSnapshot({
    rootPath,
    createdAt: input.now ?? new Date().toISOString(),
    gitBinary: input.gitBinary
  });
  const layout = ensureLocalProjectLayout(snapshot.rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== snapshot.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }

  const evidence = collectRepoSnapshotEvidence({
    projectId: config.project.projectId,
    repoId: config.project.repoId,
    snapshotId: snapshot.snapshotId,
    branch: snapshot.branch,
    commit: snapshot.commit,
    worktreeHash: snapshot.worktreeHash,
    dirtyPaths: snapshot.dirtyPaths,
    files: snapshot.files,
    rejectedFiles: snapshot.rejectedFiles,
    capturedAt: input.now ?? snapshot.createdAt
  });
  const sources = evidence.sources.filter((source) => source.sourceType === "rule_file");
  const excerpts = readLocalSourceExcerpts({ rootPath: snapshot.rootPath, sources });
  const safeRules = excerpts.filter((excerpt) => scanArtifactTextForSecrets(excerpt.excerpt).ok);
  const safeSourceIds = new Set(safeRules.map((rule) => rule.sourceId));
  const rejectedRuleRefs = sources
    .filter((source) => !safeSourceIds.has(source.sourceId))
    .map((source) => source.sourceRef)
    .sort();

  return {
    rootPath: snapshot.rootPath,
    branch: snapshot.branch,
    headCommit: snapshot.commit,
    dirtyWorktree: snapshot.worktreeStatus !== "clean",
    rules: safeRules.map((rule) => toRuleSummary(rule, sources)).sort((left, right) => left.sourceRef.localeCompare(right.sourceRef)),
    rejectedRuleRefs,
    warnings: rejectedRuleRefs.length > 0 ? ["rule_file_excerpt_rejected"] : []
  };
}

function toRuleSummary(
  excerpt: ReturnType<typeof readLocalSourceExcerpts>[number],
  sources: readonly SourceRecord[]
): LocalRuleSummary {
  const source = sources.find((candidate) => candidate.sourceId === excerpt.sourceId);
  return {
    sourceId: excerpt.sourceId,
    sourceRef: excerpt.sourceRef,
    sourceHash: excerpt.sourceHash,
    sourceScope: source?.sourceScope ?? excerpt.sourceScope,
    proofId: excerpt.proofId,
    excerptHash: excerpt.excerptHash,
    startLine: excerpt.startLine,
    endLine: excerpt.endLine,
    truncated: excerpt.truncated,
    body: excerpt.excerpt
  };
}
