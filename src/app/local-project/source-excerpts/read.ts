import { createHash } from "node:crypto";
import path from "node:path";

import {
  repositorySourceProofId,
  selectedExactSourceSources
} from "../../../core/compiler/index.js";
import type {
  RepositoryArtifactSourceAnchorInput,
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactSourceInput
} from "../../../core/compiler/index.js";
import { readAllowedSourceBytes } from "./path.js";
import { selectSourceExcerptWindows } from "./window.js";

export interface ReadLocalSourceExcerptsInput {
  readonly rootPath: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly preferredSourceRefs?: readonly string[];
  readonly queryTerms?: readonly string[];
  readonly sourceAnchors?: readonly RepositoryArtifactSourceAnchorInput[];
}

export function readLocalSourceExcerpts(
  input: ReadLocalSourceExcerptsInput
): readonly RepositoryArtifactSourceExcerptInput[] {
  const rootPath = path.resolve(input.rootPath);
  const anchorsBySourceRef = groupAnchorsBySourceRef(input.sourceAnchors ?? []);
  return selectedExactSourceSources(input.sources, input.preferredSourceRefs ?? []).flatMap(
    (source): RepositoryArtifactSourceExcerptInput[] => {
      const bytes = readAllowedSourceBytes(rootPath, source.sourceRef);
      if (!bytes) return [];
      if (sha256(bytes) !== source.sourceHash) return [];

      const text = bytes.toString("utf8");
      if (text.includes("\0")) return [];

      return selectSourceExcerptWindows({
        text,
        queryTerms: input.queryTerms,
        anchorLines: (anchorsBySourceRef.get(source.sourceRef) ?? []).map((anchor) => anchor.startLine)
      }).map((excerpt) => {
        const excerptHash = sha256(Buffer.from(excerpt.text, "utf8"));
        return {
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
          startLine: excerpt.startLine,
          endLine: excerpt.endLine,
          truncated: excerpt.truncated
        };
      });
    }
  );
}

function groupAnchorsBySourceRef(
  anchors: readonly RepositoryArtifactSourceAnchorInput[]
): ReadonlyMap<string, readonly RepositoryArtifactSourceAnchorInput[]> {
  const bySourceRef = new Map<string, RepositoryArtifactSourceAnchorInput[]>();
  for (const anchor of anchors) {
    const sourceAnchors = bySourceRef.get(anchor.sourceRef) ?? [];
    sourceAnchors.push(anchor);
    bySourceRef.set(anchor.sourceRef, sourceAnchors);
  }
  return bySourceRef;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
