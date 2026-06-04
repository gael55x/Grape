import type { SourceType } from "../../shared/index.js";

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
}

export interface TaskRetrievalLexicalMatch {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly matchedTerm: string;
}

export interface TaskRetrievalRelationship {
  readonly sourceRef: string;
  readonly targetSourceRef: string;
  readonly relationship: "imports" | "calls" | string;
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
  readonly seedFiles?: readonly string[];
  readonly seedSymbols?: readonly string[];
  readonly seedTests?: readonly string[];
  readonly maxSelectedSources?: number;
}

export interface TaskSourceRetrievalResult {
  readonly selectedSourceRefs: readonly string[];
  readonly explicitSourceRefs: readonly string[];
  readonly testSourceRefs: readonly string[];
  readonly relatedTestSourceRefs: readonly string[];
  readonly graphSourceRefs: readonly string[];
  readonly symbolSourceRefs: readonly string[];
  readonly lexicalSourceRefs: readonly string[];
  readonly sourceAnchors: readonly TaskSourceRetrievalAnchor[];
  readonly queryTerms: readonly string[];
  readonly warnings: readonly string[];
}

export interface TaskSourceRetrievalAnchor {
  readonly sourceRef: string;
  readonly reason: "symbol_match";
  readonly label: string;
  readonly startLine: number;
  readonly endLine: number;
}

type SelectionReason =
  | "explicit_seed"
  | "test_seed"
  | "related_test"
  | "graph_related"
  | "symbol_match"
  | "lexical_match";

const defaultMaxTerms = 12;
const defaultMaxSelectedSources = 8;
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
  "point",
  "points",
  "repo",
  "repository",
  "the",
  "this",
  "update",
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
  const sourceAnchors: TaskSourceRetrievalAnchor[] = [];
  const warnings: string[] = [];

  for (const seedFile of input.seedFiles ?? []) {
    const normalized = normalizeSeedFile(seedFile);
    if (!normalized || !sourceByRef.has(normalized)) {
      warnings.push(`task_seed_file_not_found:${normalized ?? "invalid"}`);
      continue;
    }
    addReason(selectedReasons, normalized, "explicit_seed");
  }

  for (const seedTest of input.seedTests ?? []) {
    if (!isPathLikeTestSeed(seedTest)) continue;
    const normalized = normalizeSeedFile(seedTest);
    if (!normalized || !sourceByRef.has(normalized)) {
      warnings.push(`task_seed_test_not_found:${normalized ?? "invalid"}`);
      continue;
    }
    addReason(selectedReasons, normalized, "test_seed");
  }

  const normalizedTerms = new Set(queryTerms);
  for (const symbol of input.symbols) {
    const sourceRef = sourceRefById.get(symbol.sourceId);
    if (!sourceRef) continue;
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
  addGraphRelatedSources(selectedReasons, sourceByRef, relationships, new Set(selectedReasons.keys()));
  addRelatedTests(selectedReasons, sourceByRef, relationships, new Set(selectedReasons.keys()));

  for (const match of input.lexicalMatches) {
    const sourceRef = sourceRefById.get(match.sourceId) ?? match.sourceRef;
    if (!sourceByRef.has(sourceRef)) continue;
    addReason(selectedReasons, sourceRef, "lexical_match");
    addGraphRelatedSources(selectedReasons, sourceByRef, relationships, new Set([sourceRef]));
    addRelatedTests(selectedReasons, sourceByRef, relationships, new Set([sourceRef]));
  }

  const selectedSourceRefs = [...selectedReasons.keys()].slice(0, maxSelectedSources);
  if (selectedReasons.size > maxSelectedSources) warnings.push("task_retrieval_truncated");
  if (queryTerms.length > 0 && selectedSourceRefs.length === 0) warnings.push("task_retrieval_no_source_matches");
  if (
    selectedSourceRefs.some((sourceRef) => isImplementationSourceRef(sourceRef, sourceByRef)) &&
    refsForReason(selectedReasons, selectedSourceRefs, "test_seed").length === 0 &&
    refsForReason(selectedReasons, selectedSourceRefs, "related_test").length === 0
  ) {
    warnings.push("task_retrieval_no_related_tests_found");
  }

  return {
    selectedSourceRefs,
    explicitSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "explicit_seed"),
    testSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "test_seed"),
    relatedTestSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "related_test"),
    graphSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "graph_related"),
    symbolSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "symbol_match"),
    lexicalSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "lexical_match"),
    sourceAnchors: sourceAnchors.filter((anchor) => selectedSourceRefs.includes(anchor.sourceRef)),
    queryTerms,
    warnings
  };
}

function addGraphRelatedSources(
  selectedReasons: Map<string, Set<SelectionReason>>,
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  relationships: readonly TaskRetrievalRelationship[],
  sourceRefs: ReadonlySet<string>
): void {
  for (const relationship of relationships) {
    if (!isGraphExpansionRelationship(relationship.relationship)) continue;
    if (!sourceRefs.has(relationship.sourceRef)) continue;
    if (!sourceByRef.has(relationship.targetSourceRef)) continue;
    if (relationship.targetSourceRef === relationship.sourceRef) continue;
    addReason(selectedReasons, relationship.targetSourceRef, "graph_related");
  }
}

function addRelatedTests(
  selectedReasons: Map<string, Set<SelectionReason>>,
  sourceByRef: ReadonlyMap<string, TaskRetrievalSource>,
  relationships: readonly TaskRetrievalRelationship[],
  targetSourceRefs: ReadonlySet<string>
): void {
  for (const relationship of relationships) {
    if (!isGraphExpansionRelationship(relationship.relationship)) continue;
    if (!targetSourceRefs.has(relationship.targetSourceRef)) continue;
    if (!sourceByRef.has(relationship.sourceRef)) continue;
    if (!isTestSourceRef(relationship.sourceRef)) continue;
    addReason(selectedReasons, relationship.sourceRef, "related_test");
  }
}

function isGraphExpansionRelationship(relationship: string): boolean {
  return relationship === "imports" || relationship === "calls";
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

function isPathLikeTestSeed(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.includes("/") || trimmed.includes("\\")) return true;
  return /\.(test|spec|e2e)\.[A-Za-z0-9]+$/.test(trimmed);
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
