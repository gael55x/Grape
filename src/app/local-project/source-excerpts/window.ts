const maxExcerptLines = 40;
const maxExcerptCharacters = 2_000;
const contextBeforeMatchedLine = 8;
const maxWindowsPerSource = 2;

export interface SelectSourceExcerptWindowInput {
  readonly text: string;
  readonly queryTerms?: readonly string[];
  readonly anchorLine?: number;
  readonly anchorLines?: readonly number[];
}

export interface SourceExcerptWindow {
  readonly text: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
}

export function selectSourceExcerptWindow(input: SelectSourceExcerptWindowInput): SourceExcerptWindow {
  return selectSourceExcerptWindows(input)[0];
}

export function selectSourceExcerptWindows(
  input: SelectSourceExcerptWindowInput
): readonly SourceExcerptWindow[] {
  const lines = normalizedLines(input.text);
  const windows: SourceExcerptWindow[] = [];

  for (const anchorIndex of rankedAnchorIndexes(lines, input)) {
    const window = sourceExcerptWindow(lines, anchorIndex);
    if (windows.some((existing) => windowsOverlap(existing, window))) continue;
    windows.push(window);
    if (windows.length >= maxWindowsPerSource) return windows;
  }

  return windows;
}

function sourceExcerptWindow(
  lines: readonly string[],
  anchorIndex: number
): SourceExcerptWindow {
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

function rankedAnchorIndexes(
  lines: readonly string[],
  input: SelectSourceExcerptWindowInput
): readonly number[] {
  const anchorIndexes: number[] = [];
  addAnchorIndexes(anchorIndexes, lines, input.anchorLines ?? []);
  if (input.anchorLine !== undefined) addAnchorIndexes(anchorIndexes, lines, [input.anchorLine]);
  if (anchorIndexes.length > 0) return anchorIndexes;

  const indexes: number[] = [];
  addIndexes(indexes, matchingLineIndexes(lines, input.queryTerms ?? []));
  if (indexes.length === 0) indexes.push(0);
  return indexes;
}

function addAnchorIndexes(indexes: number[], lines: readonly string[], anchorLines: readonly number[]): void {
  for (const anchorLine of anchorLines) {
    const index = lineAnchorIndex(lines, anchorLine);
    if (index !== undefined) addIndexes(indexes, [index]);
  }
}

function addIndexes(indexes: number[], nextIndexes: readonly number[]): void {
  for (const index of nextIndexes) {
    if (!indexes.includes(index)) indexes.push(index);
  }
}

function lineAnchorIndex(lines: readonly string[], anchorLine: number | undefined): number | undefined {
  if (anchorLine === undefined || !Number.isInteger(anchorLine) || anchorLine < 1) return undefined;
  return Math.min(anchorLine - 1, Math.max(0, lines.length - 1));
}

function normalizedLines(text: string): readonly string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function matchingLineIndexes(
  lines: readonly string[],
  queryTerms: readonly string[]
): readonly number[] {
  const normalizedTerms = queryTerms
    .map(normalizeSearchText)
    .filter((term) => term.length >= 3);
  if (normalizedTerms.length === 0) return [];

  const indexes: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeSearchText(lines[index]);
    if (normalizedTerms.some((term) => line.includes(term))) indexes.push(index);
  }

  return indexes;
}

function windowsOverlap(left: SourceExcerptWindow, right: SourceExcerptWindow): boolean {
  return left.startLine <= right.endLine && right.startLine <= left.endLine;
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
