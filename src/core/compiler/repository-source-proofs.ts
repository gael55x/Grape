import type { RepositoryArtifactSourceExcerptInput } from "./repository-context-types.js";
import { hashStableParts } from "./repository-context-hash.js";

export function repositorySourceProofId(input: {
  readonly sourceId: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
}): string {
  return `proof:${hashStableParts([input.sourceId, input.sourceHash, input.excerptHash]).slice(0, 24)}`;
}

export function sourceProofDependencyId(proofId: string): string {
  return `proof:${proofId.replace(/^proof:/, "")}`;
}

export function sourceProofRefs(
  excerpts: readonly RepositoryArtifactSourceExcerptInput[]
): string[] {
  return excerpts.map((excerpt) => excerpt.proofId);
}
