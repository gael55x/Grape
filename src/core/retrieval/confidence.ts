import type { RetrievalConfidenceShape } from "../../shared/index.js";

export interface TaskRetrievalConfidenceInput {
  readonly selectedSourceRefs: readonly string[];
  readonly explicitSourceRefs: readonly string[];
  readonly testSourceRefs: readonly string[];
  readonly relatedTestSourceRefs: readonly string[];
  readonly graphSourceRefs: readonly string[];
  readonly symbolSourceRefs: readonly string[];
  readonly lexicalSourceRefs: readonly string[];
  readonly queryTerms: readonly string[];
  readonly warnings: readonly string[];
}

export function classifyTaskRetrievalConfidence(
  input: TaskRetrievalConfidenceInput
): RetrievalConfidenceShape {
  const reasons = taskRetrievalConfidenceReasons(input);

  if (hasMissingLikelyFilesSignal(input)) {
    return {
      state: "missing_likely_files",
      reasons
    };
  }

  if (!hasSelectedSource(input) || input.warnings.length > 0 || !hasDirectEvidence(input)) {
    return {
      state: "partial",
      reasons
    };
  }

  return {
    state: "safe",
    reasons
  };
}

function taskRetrievalConfidenceReasons(input: TaskRetrievalConfidenceInput): readonly string[] {
  const reasons: string[] = [];

  if (hasSelectedSource(input)) reasons.push("selected_current_sources");
  if (input.explicitSourceRefs.length > 0) reasons.push("explicit_source_seed_matched");
  if (input.testSourceRefs.length > 0) reasons.push("test_seed_matched");
  if (input.symbolSourceRefs.length > 0) reasons.push("symbol_evidence_matched");
  if (input.relatedTestSourceRefs.length > 0) reasons.push("related_test_evidence_matched");
  if (input.graphSourceRefs.length > 0) reasons.push("graph_expansion_used");
  if (input.lexicalSourceRefs.length > 0) reasons.push("lexical_match_used");
  if (input.warnings.includes("task_retrieval_no_related_tests_found")) reasons.push("related_tests_not_found");
  if (input.warnings.length > 0) reasons.push("retrieval_warnings_present");
  if (input.queryTerms.length > 0 && input.selectedSourceRefs.length === 0) reasons.push("query_terms_had_no_selected_sources");
  if (!hasDirectEvidence(input) && hasSelectedSource(input)) reasons.push("direct_evidence_missing");
  if (hasSeedMissingWarning(input.warnings)) reasons.push("seed_refs_missing");
  if (hasCapOmissionWarning(input.warnings)) reasons.push("source_cap_omitted_candidates");

  return reasons.length > 0 ? reasons : ["no_task_selection_evidence"];
}

function hasSelectedSource(input: TaskRetrievalConfidenceInput): boolean {
  return input.selectedSourceRefs.length > 0;
}

function hasDirectEvidence(input: TaskRetrievalConfidenceInput): boolean {
  return (
    input.explicitSourceRefs.length > 0 ||
    input.testSourceRefs.length > 0 ||
    input.symbolSourceRefs.length > 0 ||
    input.relatedTestSourceRefs.length > 0
  );
}

function hasMissingLikelyFilesSignal(input: TaskRetrievalConfidenceInput): boolean {
  return (
    input.warnings.includes("task_retrieval_no_source_matches") ||
    hasSeedMissingWarning(input.warnings) ||
    hasCapOmissionWarning(input.warnings) ||
    (input.queryTerms.length > 0 && input.selectedSourceRefs.length === 0)
  );
}

function hasSeedMissingWarning(warnings: readonly string[]): boolean {
  return warnings.some(
    (warning) =>
      warning.startsWith("task_seed_file_not_found:") ||
      warning.startsWith("task_seed_test_not_found:")
  );
}

function hasCapOmissionWarning(warnings: readonly string[]): boolean {
  return warnings.some(
    (warning) =>
      warning === "task_retrieval_truncated" ||
      warning.startsWith("task_retrieval_omitted_over_cap:") ||
      warning.startsWith("task_retrieval_package_groups_omitted_over_cap:") ||
      warning.startsWith("task_retrieval_language_groups_omitted_over_cap:") ||
      warning.startsWith("task_retrieval_seed_packages_omitted_over_cap:") ||
      warning.startsWith("task_retrieval_seed_languages_omitted_over_cap:")
  );
}
