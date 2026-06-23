import type { SourceType } from "../../shared/index.js";
import type { RetrievalConfidenceShape } from "../../shared/index.js";
import { packageRootForSourceRef } from "../scope/package-root.js";
import { classifyTaskRetrievalConfidence } from "./confidence.js";
import {
  buildTaskSemanticCandidates,
  type TaskSemanticCandidate
} from "./semantic-candidates.js";
import { computeReservedSeedSlots, inferRetrievalTaskKind, isPathLikeTestSeed } from "./seed-slots.js";
import { compareStableStrings } from "./stable-compare.js";
import {
  countTier1bRefs,
  filterSemanticCandidatesToSelected,
  selectTieredSourceRefs,
  type SelectionReason
} from "./tier-selection.js";

export interface TaskRetrievalSource {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceType: SourceType;
}

export interface TaskRetrievalSymbol {
  readonly sourceId: string;
  readonly path: string;
  readonly name: string;
  readonly symbolKind?: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly packageRoot?: string;
  readonly language?: string;
}

export interface TaskRetrievalLexicalMatch {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly matchedTerm: string;
}

export interface TaskRetrievalRelationship {
  readonly relationshipRef?: string;
  readonly sourceRef: string;
  readonly targetSourceRef: string;
  readonly relationship: "imports" | "calls" | string;
}

export interface TaskRetrievalObservedFailureLink {
  readonly claimId: string;
  readonly observedRunId?: string;
  readonly testSourceRefs: readonly string[];
  readonly candidateSourceRefs: readonly string[];
}

export interface TaskRetrievalTermInput {
  readonly task: string;
  readonly symbols?: readonly string[];
  readonly tests?: readonly string[];
}

export interface TaskSourceRetrievalInput {
  readonly task: string;
  readonly sources: readonly TaskRetrievalSource[];
  readonly symbols: readonly TaskRetrievalSymbol[];
  readonly lexicalMatches: readonly TaskRetrievalLexicalMatch[];
  readonly relationships?: readonly TaskRetrievalRelationship[];
  readonly observedFailureLinks?: readonly TaskRetrievalObservedFailureLink[];
  readonly seedFiles?: readonly string[];
  readonly seedSymbols?: readonly string[];
  readonly seedTests?: readonly string[];
  readonly maxSelectedSources?: number;
}

export interface TaskSourceRetrievalResult {
  readonly selectedSourceRefs: readonly string[];
  readonly rankedSourceRefs: readonly string[];
  readonly semanticCandidates: readonly TaskSemanticCandidate[];
  readonly explicitSourceRefs: readonly string[];
  readonly testSourceRefs: readonly string[];
  readonly observedFailureSourceRefs: readonly string[];
  readonly observedFailureTestSourceRefs: readonly string[];
  readonly observedFailureLinks: readonly TaskRetrievalObservedFailureLink[];
  readonly relatedTestSourceRefs: readonly string[];
  readonly relatedTestRelationships: readonly TaskRetrievalRelatedTestRelationship[];
  readonly graphSourceRefs: readonly string[];
  readonly symbolSourceRefs: readonly string[];
  readonly lexicalSourceRefs: readonly string[];
  readonly sourceAnchors: readonly TaskSourceRetrievalAnchor[];
  readonly queryTerms: readonly string[];
  readonly warnings: readonly string[];
  readonly confidence: RetrievalConfidenceShape;
}

export interface TaskRetrievalRelatedTestRelationship {
  readonly relationshipRef?: string;
  readonly testSourceRef: string;
  readonly targetSourceRef: string;
  readonly relationship: "imports" | "calls";
}

export interface TaskSourceRetrievalAnchor {
  readonly sourceRef: string;
  readonly reason: "symbol_match";
  readonly label: string;
  readonly startLine: number;
  readonly endLine: number;
}

const defaultMaxTerms = 12;
const defaultMaxSelectedSources = 8;
const maxMissingSeedRefWarnings = 5;
const stopWords = new Set([
  "about",
  "after",
  "before",
  "change",
  "code",
  "context",
  "entry",
  "explain",
  "file",
  "files",
  "fix",
  "for",
  "from",
  "into",
  "package",
  "packages",
  "point",
  "points",
  "repo",
  "repository",
  "src",
  "test",
  "tests",
  "the",
  "this",
  "update",
  "workspace",
  "workspaces",
  "with"
]);

export function taskRetrievalTerms(input: TaskRetrievalTermInput): readonly string[] {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const value of [input.task, ...(input.symbols ?? []), ...(input.tests ?? [])]) {
    for (const token of tokenize(value)) {
      if (seen.has(token)) continue;
      seen.add(token);
      terms.push(token);
      if (terms.length >= defaultMaxTerms) return terms;
    }
  }

  return terms;
}

export function resolveTaskSourceRetrieval(input: TaskSourceRetrievalInput): TaskSourceRetrievalResult {
  const maxSelectedSources = input.maxSelectedSources ?? defaultMaxSelectedSources;
  const queryTerms = taskRetrievalTerms({
    task: input.task,
    symbols: input.seedSymbols,
    tests: input.seedTests
  });
  const sourceByRef = new Map(input.sources.map((source) => [source.sourceRef, source]));
  const sourceRefById = new Map(input.sources.map((source) => [source.sourceId, source.sourceRef]));
  const selectedReasons = new Map<string, Set<SelectionReason>>();
  const relatedTestRelationships: TaskRetrievalRelatedTestRelationship[] = [];
  const sourceAnchors: TaskSourceRetrievalAnchor[] = [];
  const warnings: string[] = [];
  const missingSeedWarnings = newMissingSeedWarningCounts();
  const explicitPathRefs = new Set<string>();

  const excludedPathPrefixes = taskExcludedPathPrefixes(input.task);
  const isExcludedSourceRef = (sourceRef: string): boolean =>
    isTaskExcludedSourceRef(sourceRef, excludedPathPrefixes);

  for (const seedFile of input.seedFiles ?? []) {
    const normalized = normalizeSeedFile(seedFile);
    if (!normalized || !sourceByRef.has(normalized) || isExcludedSourceRef(normalized)) {
      addMissingSeedWarning(warnings, "file", normalized ?? "invalid", missingSeedWarnings);
      continue;
    }
    addReason(selectedReasons, normalized, "explicit_seed");
    explicitPathRefs.add(normalized);
  }

  for (const taskSourceRef of taskMentionedSourceRefs(input.task, sourceByRef, excludedPathPrefixes)) {
    addReason(selectedReasons, taskSourceRef, "explicit_seed");
    explicitPathRefs.add(taskSourceRef);
  }

  for (const seedTest of input.seedTests ?? []) {
    if (!isPathLikeTestSeed(seedTest)) continue;
    const normalized = normalizeSeedFile(seedTest);
    if (!normalized || !sourceByRef.has(normalized) || isExcludedSourceRef(normalized)) {
      addMissingSeedWarning(warnings, "test", normalized ?? "invalid", missingSeedWarnings);
      continue;
    }
    addReason(selectedReasons, normalized, "test_seed");
    explicitPathRefs.add(normalized);
  }
  appendMissingSeedOmittedWarnings(warnings, missingSeedWarnings);

  const observedFailureLinks = selectObservedFailureLinks(
    selectedReasons,
    input.observedFailureLinks ?? [],
    sourceByRef,
    isExcludedSourceRef
  );

  const packageRootBySourceRef = packageRootsBySourceRef(input.symbols);
  const languageBySourceRef = languagesBySourceRef(input.symbols);
  const scopedCandidate = scopedCandidatePredicate(explicitPathRefs, packageRootBySourceRef);
  const normalizedTerms = new Set(queryTerms);
  const seedSymbolTerms = new Set(
    [...(input.seedSymbols ?? []), ...(input.seedTests ?? [])].flatMap((symbolName) => tokenize(symbolName))
  );
  for (const symbol of input.symbols) {
    const sourceRef = sourceRefById.get(symbol.sourceId);
    if (!sourceRef || isExcludedSourceRef(sourceRef)) continue;
    const matchesSeedSymbol = matchesAnyTerm(symbol.name, seedSymbolTerms);
    if (!scopedCandidate(sourceRef) && !matchesSeedSymbol) continue;
    if (matchesAnyTerm(symbol.name, normalizedTerms) || matchesAnyTerm(symbol.path, normalizedTerms)) {
      addReason(selectedReasons, sourceRef, "symbol_match");
      if (symbol.symbolKind !== "module" && symbol.startLine !== undefined && symbol.endLine !== undefined) {
        sourceAnchors.push({
          sourceRef,
          reason: "symbol_match",
          label: symbol.name,
          startLine: symbol.startLine,
          endLine: symbol.endLine
        });
      }
    }
  }

  const relationships = input.relationships ?? [];
  addGraphRelatedSources(
    selectedReasons,
    sourceByRef,
    relationships,
    new Set(selectedReasons.keys()),
    isExcludedSourceRef
  );
  addRelatedTests(
    selectedReasons,
    sourceByRef,
    relationships,
    new Set(selectedReasons.keys()),
    relatedTestRelationships,
    isExcludedSourceRef
  );

  for (const match of input.lexicalMatches) {
    const sourceRef = sourceRefById.get(match.sourceId) ?? match.sourceRef;
    if (!sourceByRef.has(sourceRef) || isExcludedSourceRef(sourceRef)) continue;
    if (!scopedCandidate(sourceRef)) continue;
    addReason(selectedReasons, sourceRef, "lexical_match");
    addGraphRelatedSources(selectedReasons, sourceByRef, relationships, new Set([sourceRef]), isExcludedSourceRef);
    addRelatedTests(
      selectedReasons,
      sourceByRef,
      relationships,
      new Set([sourceRef]),
      relatedTestRelationships,
      isExcludedSourceRef
    );
  }

  removeExcludedSourceRefs(selectedReasons, excludedPathPrefixes);

  const allCandidateRefs = [...selectedReasons.keys()];
  const semanticCandidatesAll = buildTaskSemanticCandidates({
    sourceRefs: allCandidateRefs,
    symbols: input.symbols,
    queryTerms,
    lexicalMatches: input.lexicalMatches
  });
  const reservedSlots = computeReservedSeedSlots({
    maxSelectedSources,
    explicitSeedCount: countRefsForReason(selectedReasons, "explicit_seed"),
    testSeedCount: countTier1bRefs(selectedReasons),
    taskKind: inferRetrievalTaskKind({
      seedTests: input.seedTests,
      seedFiles: input.seedFiles,
      task: input.task
    })
  });
  const tieredSelection = selectTieredSourceRefs({
    selectedReasons,
    maxSelectedSources,
    semanticCandidates: semanticCandidatesAll,
    reservedSlots,
    packageRootBySourceRef,
    languageBySourceRef
  });
  const selectedSourceRefs = tieredSelection.selectedSourceRefs;
  const rankedSourceRefs = selectedSourceRefs;
  const semanticCandidates = filterSemanticCandidatesToSelected(semanticCandidatesAll, selectedSourceRefs);
  const selectedSourceRefSet = new Set(selectedSourceRefs);
  warnings.push(...tieredSelection.omittedWarnings);
  if (queryTerms.length > 0 && selectedSourceRefs.length === 0) warnings.push("task_retrieval_no_source_matches");
  if (
    selectedSourceRefs.some((sourceRef) => isImplementationSourceRef(sourceRef, sourceByRef)) &&
    refsForReason(selectedReasons, selectedSourceRefs, "test_seed").length === 0 &&
    refsForReason(selectedReasons, selectedSourceRefs, "related_test").length === 0 &&
    observedFailureRefsForRole(observedFailureLinks, selectedSourceRefSet, "test").length === 0
  ) {
    warnings.push("task_retrieval_no_related_tests_found");
  }

  const result = {
    selectedSourceRefs,
    rankedSourceRefs,
    semanticCandidates,
    explicitSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "explicit_seed"),
    testSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "test_seed"),
    observedFailureSourceRefs: observedFailureRefsForRole(
      observedFailureLinks,
      selectedSourceRefSet,
      "candidate"
    ),
    observedFailureTestSourceRefs: observedFailureRefsForRole(observedFailureLinks, selectedSourceRefSet, "test"),
    observedFailureLinks: observedFailureLinks.filter((link) =>
      [...link.testSourceRefs, ...link.candidateSourceRefs].some((sourceRef) => selectedSourceRefSet.has(sourceRef))
    ),
    relatedTestSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "related_test"),
    relatedTestRelationships: sortedRelatedTestRelationships(
      relatedTestRelationships.filter(
        (relationship) =>
          selectedSourceRefSet.has(relationship.testSourceRef) &&
          selectedSourceRefSet.has(relationship.targetSourceRef)
      )
    ),
    graphSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "graph_related"),
    symbolSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "symbol_match"),
    lexicalSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "lexical_match"),
    sourceAnchors: sourceAnchors.filter((anchor) => selectedSourceRefs.includes(anchor.sourceRef)),
    queryTerms,
    warnings
  };

  return {
    ...result,
    confidence: classifyTaskRetrievalConfidence(result)
  };
}

function selectObservedFailureLinks(
  selectedReasons: Map<string, Set<SelectionReason>>,
  observedFailureLinks: readonly TaskRetrievalObservedFailureLink[],
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  isExcludedSourceRef: (sourceRef: string) => boolean
): readonly TaskRetrievalObservedFailureLink[] {
  const selectedLinks: TaskRetrievalObservedFailureLink[] = [];

  for (const link of observedFailureLinks) {
    const testSourceRefs = sourceRefsPresentForLink(link.testSourceRefs, sourceByRef, isExcludedSourceRef);
    const candidateSourceRefs = sourceRefsPresentForLink(link.candidateSourceRefs, sourceByRef, isExcludedSourceRef);
    if (testSourceRefs.length === 0 && candidateSourceRefs.length === 0) continue;

    for (const sourceRef of [...testSourceRefs, ...candidateSourceRefs]) {
      addReason(selectedReasons, sourceRef, "observed_failure_link");
    }
    selectedLinks.push({
      claimId: link.claimId,
      observedRunId: link.observedRunId,
      testSourceRefs,
      candidateSourceRefs
    });
  }

  return selectedLinks;
}

function sourceRefsPresentForLink(
  sourceRefs: readonly string[],
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  isExcludedSourceRef: (sourceRef: string) => boolean
): readonly string[] {
  return [...new Set(sourceRefs)]
    .filter((sourceRef) => sourceByRef.has(sourceRef) && !isExcludedSourceRef(sourceRef))
    .sort(compareStableStrings);
}

function observedFailureRefsForRole(
  links: readonly TaskRetrievalObservedFailureLink[],
  selectedSourceRefs: ReadonlySet<string>,
  role: "candidate" | "test"
): readonly string[] {
  const refs = new Set<string>();
  for (const link of links) {
    const sourceRefs = role === "candidate" ? link.candidateSourceRefs : link.testSourceRefs;
    for (const sourceRef of sourceRefs) {
      if (selectedSourceRefs.has(sourceRef)) refs.add(sourceRef);
    }
  }
  return [...refs].sort(compareStableStrings);
}

function addGraphRelatedSources(
  selectedReasons: Map<string, Set<SelectionReason>>,
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  relationships: readonly TaskRetrievalRelationship[],
  sourceRefs: ReadonlySet<string>,
  isExcludedSourceRef: (sourceRef: string) => boolean = () => false
): void {
  for (const relationship of relationships) {
    if (!graphExpansionRelationship(relationship.relationship)) continue;
    if (!sourceRefs.has(relationship.sourceRef)) continue;
    if (!sourceByRef.has(relationship.targetSourceRef)) continue;
    if (relationship.targetSourceRef === relationship.sourceRef) continue;
    if (isExcludedSourceRef(relationship.targetSourceRef)) continue;
    addReason(selectedReasons, relationship.targetSourceRef, "graph_related");
  }
}

function addRelatedTests(
  selectedReasons: Map<string, Set<SelectionReason>>,
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  relationships: readonly TaskRetrievalRelationship[],
  targetSourceRefs: ReadonlySet<string>,
  relatedTestRelationships: TaskRetrievalRelatedTestRelationship[],
  isExcludedSourceRef: (sourceRef: string) => boolean = () => false
): void {
  for (const relationship of relationships) {
    const relationshipKind = graphExpansionRelationship(relationship.relationship);
    if (!relationshipKind) continue;
    if (!targetSourceRefs.has(relationship.targetSourceRef)) continue;
    if (!sourceByRef.has(relationship.sourceRef)) continue;
    if (!isTestSourceRef(relationship.sourceRef)) continue;
    if (isExcludedSourceRef(relationship.sourceRef)) continue;
    addReason(selectedReasons, relationship.sourceRef, "related_test");
    addRelatedTestRelationship(relatedTestRelationships, {
      relationshipRef: relationship.relationshipRef,
      testSourceRef: relationship.sourceRef,
      targetSourceRef: relationship.targetSourceRef,
      relationship: relationshipKind
    });
  }
}

function graphExpansionRelationship(relationship: string): "imports" | "calls" | undefined {
  if (relationship === "imports" || relationship === "calls") return relationship;
  return undefined;
}

function addRelatedTestRelationship(
  relationships: TaskRetrievalRelatedTestRelationship[],
  relationship: TaskRetrievalRelatedTestRelationship
): void {
  if (
    relationships.some(
      (existing) =>
        existing.testSourceRef === relationship.testSourceRef &&
        existing.targetSourceRef === relationship.targetSourceRef &&
        existing.relationship === relationship.relationship &&
        existing.relationshipRef === relationship.relationshipRef
    )
  ) {
    return;
  }
  relationships.push(relationship);
}

function sortedRelatedTestRelationships(
  relationships: readonly TaskRetrievalRelatedTestRelationship[]
): readonly TaskRetrievalRelatedTestRelationship[] {
  return [...relationships].sort((left, right) => {
    const testRefOrder = compareStableStrings(left.testSourceRef, right.testSourceRef);
    if (testRefOrder !== 0) return testRefOrder;
    const targetRefOrder = compareStableStrings(left.targetSourceRef, right.targetSourceRef);
    if (targetRefOrder !== 0) return targetRefOrder;
    const relationshipKindOrder = relationshipOrder(left.relationship) - relationshipOrder(right.relationship);
    if (relationshipKindOrder !== 0) return relationshipKindOrder;
    return compareStableStrings(left.relationshipRef ?? "", right.relationshipRef ?? "");
  });
}

function relationshipOrder(relationship: TaskRetrievalRelatedTestRelationship["relationship"]): number {
  return relationship === "imports" ? 0 : 1;
}

function addReason(
  selectedReasons: Map<string, Set<SelectionReason>>,
  sourceRef: string,
  reason: SelectionReason
): void {
  const reasons = selectedReasons.get(sourceRef) ?? new Set<SelectionReason>();
  reasons.add(reason);
  selectedReasons.set(sourceRef, reasons);
}

function refsForReason(
  selectedReasons: ReadonlyMap<string, ReadonlySet<SelectionReason>>,
  selectedSourceRefs: readonly string[],
  reason: SelectionReason
): string[] {
  return selectedSourceRefs.filter((sourceRef) => selectedReasons.get(sourceRef)?.has(reason));
}

function countRefsForReason(
  selectedReasons: ReadonlyMap<string, ReadonlySet<SelectionReason>>,
  reason: SelectionReason
): number {
  let count = 0;
  for (const reasons of selectedReasons.values()) {
    if (reasons.has(reason)) count += 1;
  }
  return count;
}

function matchesAnyTerm(value: string, terms: ReadonlySet<string>): boolean {
  const normalized = normalizeSearchText(value);
  for (const term of terms) {
    if (normalized.includes(term)) return true;
  }
  return false;
}

function tokenize(value: string): string[] {
  const originalTokens = value.match(/[A-Za-z][A-Za-z0-9_./-]{2,}/g) ?? [];
  const tokens: string[] = [];

  for (const original of originalTokens) {
    addToken(tokens, original);
    for (const part of splitIdentifier(original)) {
      addToken(tokens, part);
    }
  }

  return tokens;
}

function splitIdentifier(value: string): readonly string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part.length > 0);
}

function addToken(tokens: string[], value: string): void {
  const normalized = normalizeSearchText(value);
  if (normalized.length < 3 || normalized.length > 80) return;
  if (stopWords.has(normalized)) return;
  if (!tokens.includes(normalized)) tokens.push(normalized);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function taskMentionedSourceRefs(
  task: string,
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  excludedPathPrefixes: readonly string[] = taskExcludedPathPrefixes(task)
): readonly string[] {
  const normalizedTask = task.replace(/\\/g, "/").toLowerCase();
  return [...sourceByRef.keys()].filter(
    (sourceRef) =>
      normalizedTask.includes(sourceRef.toLowerCase()) && !isTaskExcludedSourceRef(sourceRef, excludedPathPrefixes)
  );
}

function taskExcludedPathPrefixes(task: string): readonly string[] {
  const prefixes: string[] = [];
  const normalizedTask = task.replace(/\\/g, "/");
  for (const match of normalizedTask.matchAll(/without\s+(?:pulling\s+)?([^\s,]+?)(?:\s+context)?/gi)) {
    const prefix = normalizeSeedFile(match[1]);
    if (prefix) prefixes.push(prefix);
  }
  if (/(post-beta|1\.0\.0-beta|1\.0 beta)/i.test(task) && !/\b(legacy|alpha)\b/i.test(task)) {
    prefixes.push("docs/v1/legacy");
  }
  return prefixes;
}

function isTaskExcludedSourceRef(sourceRef: string, excludedPathPrefixes: readonly string[]): boolean {
  const normalized = sourceRef.replace(/\\/g, "/");
  return excludedPathPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

function removeExcludedSourceRefs(
  selectedReasons: Map<string, Set<SelectionReason>>,
  excludedPathPrefixes: readonly string[]
): void {
  for (const sourceRef of [...selectedReasons.keys()]) {
    if (isTaskExcludedSourceRef(sourceRef, excludedPathPrefixes)) {
      selectedReasons.delete(sourceRef);
    }
  }
}

function normalizeSeedFile(value: string): string | undefined {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /^[A-Za-z]:\//.test(normalized) ||
    /[\0\r\n\t]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function packageRootsBySourceRef(symbols: readonly TaskRetrievalSymbol[]): ReadonlyMap<string, string> {
  const roots = new Map<string, string>();
  for (const symbol of symbols) {
    const sourceRef = normalizeSeedFile(symbol.path);
    const packageRoot = normalizePackageRoot(symbol.packageRoot);
    if (!sourceRef || !packageRoot) continue;
    if (!sourceRefIsInPackageRoot(sourceRef, packageRoot)) continue;
    if (!roots.has(sourceRef)) roots.set(sourceRef, packageRoot);
  }
  return roots;
}

function languagesBySourceRef(symbols: readonly TaskRetrievalSymbol[]): ReadonlyMap<string, string> {
  const languages = new Map<string, string>();
  for (const symbol of symbols) {
    const sourceRef = normalizeSeedFile(symbol.path);
    const language = normalizeLanguage(symbol.language);
    if (!sourceRef || !language) continue;
    if (!languages.has(sourceRef)) languages.set(sourceRef, language);
  }
  return languages;
}

function normalizeLanguage(language: string | undefined): string | undefined {
  const normalized = language?.trim().toLowerCase();
  if (!normalized || /[\0\r\n\t]/.test(normalized)) return undefined;
  return normalized;
}

function normalizePackageRoot(packageRoot: string | undefined): string | undefined {
  const normalized = packageRoot ? normalizeSeedFile(packageRoot) : undefined;
  return normalized && normalized !== "." ? normalized : undefined;
}

function sourceRefIsInPackageRoot(sourceRef: string, packageRoot: string): boolean {
  return sourceRef === packageRoot || sourceRef.startsWith(`${packageRoot}/`);
}

function candidatePackageRoot(
  sourceRef: string,
  packageRootBySourceRef: ReadonlyMap<string, string>
): string | undefined {
  return packageRootForSourceRef(sourceRef) ?? packageRootBySourceRef.get(sourceRef);
}

function scopedCandidatePredicate(
  explicitPathRefs: ReadonlySet<string>,
  packageRootBySourceRef: ReadonlyMap<string, string>
): (sourceRef: string) => boolean {
  if (explicitPathRefs.size === 0) return () => true;

  const packageRoots = [
    ...new Set(
      [...explicitPathRefs]
        .map((sourceRef) => candidatePackageRoot(sourceRef, packageRootBySourceRef))
        .filter((packageRoot): packageRoot is string => Boolean(packageRoot))
    )
  ];
  if (packageRoots.length !== 1) {
    return (sourceRef) => explicitPathRefs.has(sourceRef);
  }

  const packagePrefix = `${packageRoots[0]}/`;
  return (sourceRef: string) => explicitPathRefs.has(sourceRef) || sourceRef.startsWith(packagePrefix);
}

function isTestSourceRef(value: string): boolean {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  return (
    normalized.startsWith("test/") ||
    normalized.startsWith("tests/") ||
    normalized.includes("/test/") ||
    normalized.includes("/tests/") ||
    normalized.includes("/__tests__/") ||
    /\.(test|spec|e2e)\.[a-z0-9]+$/.test(normalized)
  );
}

function isImplementationSourceRef(
  sourceRef: string,
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>
): boolean {
  const source = sourceByRef.get(sourceRef);
  return source?.sourceType === "repository_file" && !isTestSourceRef(sourceRef);
}

interface MissingSeedWarningBucket {
  emitted: number;
  omitted: number;
}

interface MissingSeedWarningCounts {
  file: MissingSeedWarningBucket;
  test: MissingSeedWarningBucket;
}

function newMissingSeedWarningCounts(): MissingSeedWarningCounts {
  return {
    file: { emitted: 0, omitted: 0 },
    test: { emitted: 0, omitted: 0 }
  };
}

function addMissingSeedWarning(
  warnings: string[],
  kind: keyof MissingSeedWarningCounts,
  ref: string,
  counts: MissingSeedWarningCounts
): void {
  const bucket = counts[kind];
  if (bucket.emitted < maxMissingSeedRefWarnings) {
    warnings.push(`task_seed_${kind}_not_found:${ref}`);
    bucket.emitted += 1;
    return;
  }
  bucket.omitted += 1;
}

function appendMissingSeedOmittedWarnings(
  warnings: string[],
  counts: MissingSeedWarningCounts
): void {
  if (counts.file.omitted > 0) {
    warnings.push(`task_seed_file_not_found_omitted:${counts.file.omitted}`);
  }
  if (counts.test.omitted > 0) {
    warnings.push(`task_seed_test_not_found_omitted:${counts.test.omitted}`);
  }
}
