import { assertArtifactTextHasNoSecrets } from "../security/index.js";

export interface TestFailureLocation {
  readonly sourceRef: string;
  readonly line: number;
  readonly column?: number;
}

const locationPatterns: readonly RegExp[] = [
  /\(([^\s():]+):(\d+):(\d+)\)/g,
  /\bat\s+(?:\S+\s+)?\(?([^\s():]+):(\d+):(\d+)\)?/g,
  /(^|\s)([^\s():]+\.[cm]?[jt]sx?):(\d+)(?::(\d+))?/g
];

export function extractTestFailureLocations(
  output: string,
  normalizePath: (candidate: string) => string | undefined
): readonly TestFailureLocation[] {
  if (!output.trim()) return [];

  const locations = new Map<string, TestFailureLocation>();
  for (const pattern of locationPatterns) {
    pattern.lastIndex = 0;
    for (const match of output.matchAll(pattern)) {
      const groups = match.length === 5 ? [match[2], match[3], match[4]] : [match[1], match[2], match[3]];
      const rawPath = groups[0];
      const line = Number(groups[1]);
      const column = groups[2] ? Number(groups[2]) : undefined;
      if (!rawPath || !Number.isFinite(line) || line < 1) continue;
      if (!safeLocationPath(rawPath)) continue;

      const sourceRef = normalizePath(rawPath);
      if (!sourceRef) continue;

      const key = `${sourceRef}:${line}`;
      if (!locations.has(key)) {
        locations.set(key, {
          sourceRef,
          line,
          column: column !== undefined && Number.isFinite(column) ? column : undefined
        });
      }
    }
  }

  return [...locations.values()].sort((left, right) => {
    const pathOrder = left.sourceRef.localeCompare(right.sourceRef);
    if (pathOrder !== 0) return pathOrder;
    return left.line - right.line;
  });
}

function safeLocationPath(rawPath: string): boolean {
  const normalized = rawPath.replace(/\\/g, "/").replace(/^file:\/\//, "");
  if (normalized.includes("..") || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    return false;
  }
  try {
    assertArtifactTextHasNoSecrets(normalized, "test failure location");
    return true;
  } catch {
    return false;
  }
}
