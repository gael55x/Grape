import type { InMemoryContextSectionShape } from "../../shared/index.js";
import { repositoryContextSectionHash } from "./repository-context-integrity.js";

export function repositoryContextSection(
  input: Omit<InMemoryContextSectionShape, "contentHash" | "redactionStatus" | "proofRefs" | "sourceRefs"> & {
    readonly sourceRefs?: readonly string[];
    readonly proofRefs?: readonly string[];
  }
): InMemoryContextSectionShape {
  const sectionWithoutHash = {
    ...input,
    sourceRefs: [...(input.sourceRefs ?? [])],
    proofRefs: [...(input.proofRefs ?? [])],
    contentHash: "0".repeat(64),
    redactionStatus: "clean" as const
  };
  return {
    ...sectionWithoutHash,
    contentHash: repositoryContextSectionHash(sectionWithoutHash)
  };
}
