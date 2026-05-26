import { selectedSourceExcerpts } from "./repository-context-selection.js";
import type {
  CompileRepositoryContextArtifactInput,
  RepositoryArtifactSourceExcerptInput
} from "./repository-context-types.js";

export interface RepositoryRiskPolicyResult {
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
}

export function evaluateRepositoryRiskPolicy(
  input: CompileRepositoryContextArtifactInput
): RepositoryRiskPolicyResult {
  if (input.riskOverlays.length === 0) {
    return {
      warnings: [],
      unsafeReasons: []
    };
  }

  const exactExcerpts = selectedPolicyExactSourceExcerpts(input);
  return {
    warnings: ["risk_overlay_requires_exact_context"],
    unsafeReasons: exactExcerpts.length === 0 ? ["risk_overlay_missing_exact_context"] : []
  };
}

export function selectedPolicyExactSourceExcerpts(
  input: CompileRepositoryContextArtifactInput
): readonly RepositoryArtifactSourceExcerptInput[] {
  if (input.riskOverlays.length === 0) {
    return selectedSourceExcerpts(input.sourceExcerpts, input.taskRetrieval?.selectedSourceRefs ?? []);
  }

  const taskSelectedRefs = new Set(input.taskRetrieval?.selectedSourceRefs ?? []);
  if (taskSelectedRefs.size === 0) return [];

  return selectedSourceExcerpts(input.sourceExcerpts, [...taskSelectedRefs]).filter((excerpt) =>
    taskSelectedRefs.has(excerpt.sourceRef)
  );
}
