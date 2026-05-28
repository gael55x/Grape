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
  readonly seedFiles?: readonly string[];
  readonly seedSymbols?: readonly string[];
  readonly seedTests?: readonly string[];
  readonly maxSelectedSources?: number;
}

export interface TaskSourceRetrievalResult {
  readonly selectedSourceRefs: readonly string[];
  readonly explicitSourceRefs: readonly string[];
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

type SelectionReason = "explicit_seed" | "symbol_match" | "lexical_match";

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

  for (const match of input.lexicalMatches) {
    const sourceRef = sourceRefById.get(match.sourceId) ?? match.sourceRef;
    if (!sourceByRef.has(sourceRef)) continue;
    addReason(selectedReasons, sourceRef, "lexical_match");
  }

  const selectedSourceRefs = [...selectedReasons.keys()].slice(0, maxSelectedSources);
  if (selectedReasons.size > maxSelectedSources) warnings.push("task_retrieval_truncated");
  if (queryTerms.length > 0 && selectedSourceRefs.length === 0) warnings.push("task_retrieval_no_source_matches");

  return {
    selectedSourceRefs,
    explicitSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "explicit_seed"),
    symbolSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "symbol_match"),
    lexicalSourceRefs: refsForReason(selectedReasons, selectedSourceRefs, "lexical_match"),
    sourceAnchors: sourceAnchors.filter((anchor) => selectedSourceRefs.includes(anchor.sourceRef)),
    queryTerms,
    warnings
  };
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
  const normalized = value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
  if (
    normalized === "" ||
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    /[\0\r\n\t]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}
