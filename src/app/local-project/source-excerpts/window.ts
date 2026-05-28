const maxExcerptLines = 40;
const maxExcerptCharacters = 2_000;
const contextBeforeMatchedLine = 8;

export interface SelectSourceExcerptWindowInput {
  readonly text: string;
  readonly queryTerms?: readonly string[];
}

export interface SourceExcerptWindow {
  readonly text: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
}

export function selectSourceExcerptWindow(input: SelectSourceExcerptWindowInput): SourceExcerptWindow {
  const lines = normalizedLines(input.text);
  const anchorIndex = firstMatchingLineIndex(lines, input.queryTerms ?? []) ?? 0;
  const startIndex = Math.max(0, anchorIndex - contextBeforeMatchedLine);
  const selectedLines = lines.slice(startIndex, startIndex + maxExcerptLines);
  const rawExcerpt = selectedLines.join("\n");
  const clipped = clipByCharacters(rawExcerpt);
  const includedLineCount = countIncludedLines(clipped.text);

  return {
    text: clipped.text,
    startLine: startIndex + 1,
    endLine: Math.max(startIndex + 1, startIndex + includedLineCount),
    truncated: clipped.truncated || startIndex > 0 || startIndex + selectedLines.length < lines.length
  };
}

function normalizedLines(text: string): readonly string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function firstMatchingLineIndex(
  lines: readonly string[],
  queryTerms: readonly string[]
): number | undefined {
  const normalizedTerms = queryTerms
    .map(normalizeSearchText)
    .filter((term) => term.length >= 3);
  if (normalizedTerms.length === 0) return undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeSearchText(lines[index]);
    if (normalizedTerms.some((term) => line.includes(term))) return index;
  }

  return undefined;
}

function clipByCharacters(text: string): { readonly text: string; readonly truncated: boolean } {
  if (text.length <= maxExcerptCharacters) return { text, truncated: false };
  return { text: text.slice(0, maxExcerptCharacters), truncated: true };
}

function countIncludedLines(text: string): number {
  if (text.length === 0) return 1;
  return text.split("\n").length;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
