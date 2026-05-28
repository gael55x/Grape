import { createHash } from "node:crypto";
import path from "node:path";

import {
  repositorySourceProofId,
  selectedExactSourceSources
} from "../../../core/compiler/index.js";
import type {
  RepositoryArtifactSourceExcerptInput,
  RepositoryArtifactSourceInput
} from "../../../core/compiler/index.js";
import { readAllowedSourceBytes } from "./path.js";
import { selectSourceExcerptWindow } from "./window.js";

export interface ReadLocalSourceExcerptsInput {
  readonly rootPath: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly preferredSourceRefs?: readonly string[];
  readonly queryTerms?: readonly string[];
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

      const excerpt = selectSourceExcerptWindow({
        text,
        queryTerms: input.queryTerms
      });
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
          startLine: excerpt.startLine,
          endLine: excerpt.endLine,
          truncated: excerpt.truncated
        }
      ];
    }
  );
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
