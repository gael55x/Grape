import type { TaskRetrievalLexicalMatch, TaskRetrievalSymbol } from "./task-source-retrieval.js";
import { assertConservativeTrustWording, TRUST_WORDING_DISCLAIMERS } from "../../shared/trust-wording.js";
import { compareStableStrings } from "./stable-compare.js";

export const SEMANTIC_CANDIDATE_TYPE = "semantic_candidate" as const;

export const SEMANTIC_CANDIDATE_ADVISORY_LABEL = TRUST_WORDING_DISCLAIMERS.semanticCandidateAdvisoryLabel;

export const SEMANTIC_CANDIDATE_SECTION_HEADER = TRUST_WORDING_DISCLAIMERS.semanticCandidateSectionHeader;

export interface TaskSemanticCandidate {
  readonly candidateType: typeof SEMANTIC_CANDIDATE_TYPE;
  readonly sourceRef: string;
  readonly score: number;
  readonly matchedSignals: readonly string[];
  readonly advisoryLabel: typeof SEMANTIC_CANDIDATE_ADVISORY_LABEL;
}

export interface BuildTaskSemanticCandidatesInput {
  readonly sourceRefs: readonly string[];
  readonly symbols: readonly TaskRetrievalSymbol[];
  readonly queryTerms: readonly string[];
  readonly lexicalMatches: readonly TaskRetrievalLexicalMatch[];
}

export function buildTaskSemanticCandidates(
  input: BuildTaskSemanticCandidatesInput
): readonly TaskSemanticCandidate[] {
  assertSemanticCandidateTrustWording();
  const normalizedTerms = input.queryTerms.map(normalizeSearchText).filter((term) => term.length > 0);
  if (normalizedTerms.length === 0 || input.sourceRefs.length === 0) return [];

  const lexicalTermsBySourceRef = lexicalTermsByRef(input.lexicalMatches);
  const symbolsBySourceRef = symbolsByRef(input.symbols);

  const candidates = input.sourceRefs.map((sourceRef) => {
    const matchedSignals = collectMatchedSignals(
      sourceRef,
      normalizedTerms,
      symbolsBySourceRef.get(sourceRef) ?? [],
      lexicalTermsBySourceRef.get(sourceRef) ?? new Set()
    );
    return {
      candidateType: SEMANTIC_CANDIDATE_TYPE,
      sourceRef,
      score: scoreMatchedSignals(matchedSignals),
      matchedSignals,
      advisoryLabel: SEMANTIC_CANDIDATE_ADVISORY_LABEL
    } satisfies TaskSemanticCandidate;
  });

  return candidates
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return compareStableStrings(left.sourceRef, right.sourceRef);
    });
}

export function orderSourceRefsBySemanticCandidates(
  sourceRefs: readonly string[],
  candidates: readonly TaskSemanticCandidate[]
): readonly string[] {
  if (sourceRefs.length <= 1) return [...sourceRefs];

  const scoreByRef = new Map(candidates.map((candidate) => [candidate.sourceRef, candidate.score]));

  return [...sourceRefs].sort((left, right) => {
    const leftScore = scoreByRef.get(left) ?? 0;
    const rightScore = scoreByRef.get(right) ?? 0;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return compareStableStrings(left, right);
  });
}

function assertSemanticCandidateTrustWording(): void {
  assertConservativeTrustWording(SEMANTIC_CANDIDATE_ADVISORY_LABEL, "semantic candidate advisory label");
  assertConservativeTrustWording(SEMANTIC_CANDIDATE_SECTION_HEADER, "semantic candidate section header");
}

function symbolsByRef(symbols: readonly TaskRetrievalSymbol[]): Map<string, TaskRetrievalSymbol[]> {
  const grouped = new Map<string, TaskRetrievalSymbol[]>();
  for (const symbol of symbols) {
    const existing = grouped.get(symbol.path) ?? [];
    existing.push(symbol);
    grouped.set(symbol.path, existing);
  }
  return grouped;
}

function lexicalTermsByRef(
  lexicalMatches: readonly TaskRetrievalLexicalMatch[]
): Map<string, Set<string>> {
  const grouped = new Map<string, Set<string>>();
  for (const match of lexicalMatches) {
    const terms = grouped.get(match.sourceRef) ?? new Set<string>();
    terms.add(normalizeSearchText(match.matchedTerm));
    grouped.set(match.sourceRef, terms);
  }
  return grouped;
}

function collectMatchedSignals(
  sourceRef: string,
  queryTerms: readonly string[],
  symbols: readonly TaskRetrievalSymbol[],
  lexicalTerms: ReadonlySet<string>
): string[] {
  const signals: string[] = [];
  const normalizedPath = normalizeSearchText(sourceRef);
  const pathSegments = sourceRef
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => normalizeSearchText(segment))
    .filter((segment) => segment.length > 0);

  for (const term of queryTerms) {
    if (pathSegments.some((segment) => segment.includes(term))) {
      signals.push(`path_segment:${term}`);
    } else if (normalizedPath.includes(term)) {
      signals.push(`path:${term}`);
    }

    for (const symbol of symbols) {
      if (symbol.symbolKind === "module") continue;
      const normalizedName = normalizeSearchText(symbol.name);
      if (normalizedName.includes(term)) {
        signals.push(`symbol:${symbol.name}:${term}`);
      }
    }

    if (lexicalTerms.has(term)) {
      signals.push(`lexical:${term}`);
    }
  }

  return [...new Set(signals)].sort(compareStableStrings);
}

function scoreMatchedSignals(matchedSignals: readonly string[]): number {
  let score = 0;
  for (const signal of matchedSignals) {
    if (signal.startsWith("symbol:")) score += 5;
    else if (signal.startsWith("lexical:")) score += 3;
    else if (signal.startsWith("path_segment:")) score += 2;
    else if (signal.startsWith("path:")) score += 1;
  }
  return score;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
