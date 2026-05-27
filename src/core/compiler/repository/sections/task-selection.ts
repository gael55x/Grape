import type { CompileRepositoryContextArtifactInput } from "../types.js";

export function preferredSourceRefs(input: CompileRepositoryContextArtifactInput): readonly string[] {
  return input.taskRetrieval?.selectedSourceRefs ?? [];
}
