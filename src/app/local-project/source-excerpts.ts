import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

import {
  repositorySourceProofId,
  selectedExactSourceSources
} from "../../core/compiler/index.js";
import type {
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactSourceInput
} from "../../core/compiler/index.js";

const maxExcerptLines = 40;
const maxExcerptCharacters = 2_000;

export interface ReadLocalSourceExcerptsInput {
  readonly rootPath: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly preferredSourceRefs?: readonly string[];
}

export function readLocalSourceExcerpts(
  input: ReadLocalSourceExcerptsInput
): readonly RepositoryArtifactSourceExcerptInput[] {
  const rootPath = path.resolve(input.rootPath);
  return selectedExactSourceSources(input.sources, input.preferredSourceRefs ?? []).flatMap(
    (source): RepositoryArtifactSourceExcerptInput[] => {
      const bytes = readAllowedSourceBytes(rootPath, source.sourceRef);
      if (!bytes) return [];
      if (sha256(bytes) !== source.sourceHash) return [];

      const text = bytes.toString("utf8");
      if (text.includes("\0")) return [];

      const excerpt = truncateExcerpt(text);
      const excerptHash = sha256(Buffer.from(excerpt.text, "utf8"));
      return [
        {
          proofId: repositorySourceProofId({
            sourceId: source.sourceId,
            sourceHash: source.sourceHash,
            excerptHash
          }),
          sourceId: source.sourceId,
          sourceType: source.sourceType,
          sourceRef: source.sourceRef,
          sourceHash: source.sourceHash,
          sourceScope: source.sourceScope,
          excerpt: excerpt.text,
          excerptHash,
          startLine: 1,
          endLine: excerpt.endLine,
          truncated: excerpt.truncated
        }
      ];
    }
  );
}

function readAllowedSourceBytes(rootPath: string, sourceRef: string): Buffer | undefined {
  const normalizedRef = normalizeRepoPath(sourceRef);
  if (!normalizedRef) return undefined;
  const absolutePath = path.resolve(rootPath, normalizedRef);
  if (!isInsideRoot(rootPath, absolutePath)) return undefined;

  try {
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() && !stat.isSymbolicLink()) return undefined;
    return stat.isSymbolicLink()
      ? Buffer.from(`symlink:${readlinkSync(absolutePath)}`)
      : readFileSync(absolutePath);
  } catch {
    return undefined;
  }
}

function isInsideRoot(rootPath: string, absolutePath: string): boolean {
  const relativePath = path.relative(rootPath, absolutePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function normalizeRepoPath(inputPath: string): string | undefined {
  const normalized = inputPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized === "" || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    return undefined;
  }
  return normalized;
}

function truncateExcerpt(text: string): { readonly text: string; readonly endLine: number; readonly truncated: boolean } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const selectedLines = lines.slice(0, maxExcerptLines);
  let excerpt = selectedLines.join("\n");
  let truncated = lines.length > maxExcerptLines;

  if (excerpt.length > maxExcerptCharacters) {
    excerpt = excerpt.slice(0, maxExcerptCharacters);
    truncated = true;
  }

  return {
    text: excerpt,
    endLine: Math.max(1, selectedLines.length),
    truncated
  };
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
