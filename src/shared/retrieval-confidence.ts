export type RetrievalConfidenceState = "safe" | "partial" | "missing_likely_files";

export interface RetrievalConfidenceShape {
  readonly state: RetrievalConfidenceState;
  readonly reasons: readonly string[];
}

export const retrievalConfidenceStates: readonly RetrievalConfidenceState[] = [
  "safe",
  "partial",
  "missing_likely_files"
];

export function displayRetrievalConfidenceState(state: RetrievalConfidenceState): string {
  return state.replace(/_/g, " ");
}
