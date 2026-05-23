import type { ProofRef } from "../../shared/index.js";

export type ProofSupportLevel = "exact" | "partial" | "none";

export interface ProofValidationResult {
  proof: ProofRef;
  supportLevel: ProofSupportLevel;
  sourceHashMatches: boolean;
  accepted: boolean;
  rejectionReason?: string;
}
