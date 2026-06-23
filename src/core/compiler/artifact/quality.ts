import type { RetrievalConfidenceShape } from "../../../shared/index.js";

export function confidenceFor(unsafeReasons: readonly string[], warnings: readonly string[]): "high" | "medium" | "low" {
  if (unsafeReasons.length > 0) return "low";
  if (warnings.length > 0) return "medium";
  return "high";
}

export function graphConfidenceFor(warnings: readonly string[]): "high" | "medium" | "low" | "unknown" {
  return warnings.includes("repository_artifact_uses_lightweight_index") ? "low" : "medium";
}

export function missingContextFor(
  unsafeReasons: readonly string[],
  retrievalConfidence?: RetrievalConfidenceShape
): readonly string[] {
  return [
    ...unsafeReasons.map((reason) => `missing:${reason}`),
    ...(retrievalConfidence?.state === "missing_likely_files"
      ? ["missing:task_retrieval_missing_likely_files"]
      : [])
  ];
}
