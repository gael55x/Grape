export interface ClaimEdgeAuthorityMetadata {
  readonly createdBy?: string;
  readonly confidence?: number;
  readonly reason?: string;
  readonly metadataJson?: string;
}

export interface ClaimEdgeAuthorityPolicyEdge {
  readonly edgeId?: string;
  readonly sourceClaimId: string;
  readonly targetClaimId: string;
  readonly edgeType: string;
  readonly authority?: ClaimEdgeAuthorityMetadata;
}

export interface ClaimEdgeAuthoritySummary {
  readonly createdBy: string;
  readonly confidence: number;
  readonly reason: string;
  readonly recorded: boolean;
}

export interface ClaimEdgeAuthorityDecision {
  readonly allowed: boolean;
  readonly warning?: string;
}

const blockingAuthorities = new Set(["user_confirmation", "test_verification", "grape_observed", "trusted_import"]);

export function claimEdgeAuthoritySummary(edge: ClaimEdgeAuthorityPolicyEdge): ClaimEdgeAuthoritySummary {
  const authority = edge.authority;
  if (!authority) {
    return {
      createdBy: "legacy",
      confidence: 0,
      reason: "legacy edge without recorded authority metadata",
      recorded: false
    };
  }
  return {
    createdBy: authority.createdBy ?? "legacy",
    confidence: boundedConfidence(authority.confidence),
    reason: authority.reason ?? "legacy edge without recorded authority metadata",
    recorded: authority.createdBy !== undefined
  };
}

export function claimEdgeCanBlockCurrentValid(edge: ClaimEdgeAuthorityPolicyEdge): ClaimEdgeAuthorityDecision {
  const authority = claimEdgeAuthoritySummary(edge);

  if (edge.edgeType === "contradicts" || edge.edgeType === "violates") {
    if (blockingAuthorities.has(authority.createdBy)) return { allowed: true };
    if (isLegacyAuthority(authority)) {
      return {
        allowed: true,
        warning: `Legacy ${edge.edgeType} edge lacks authority metadata and remains blocking: ${edgeLabel(edge)}`
      };
    }
    return {
      allowed: false,
      warning: `Ignored ${edge.edgeType} edge without eligible blocking authority: ${edgeLabel(edge)}`
    };
  }

  if (edge.edgeType === "supersedes") {
    if (blockingAuthorities.has(authority.createdBy)) return { allowed: true };
    return {
      allowed: false,
      warning: `Ignored supersedes edge without eligible blocking authority: ${edgeLabel(edge)}`
    };
  }

  return { allowed: false };
}

export function claimEdgeCanResolveConflict(edge: ClaimEdgeAuthorityPolicyEdge): ClaimEdgeAuthorityDecision {
  const authority = claimEdgeAuthoritySummary(edge);
  if (edge.edgeType === "coexists_with" || edge.edgeType === "variant_of") {
    if (authority.createdBy === "user_confirmation") return { allowed: true };
    return {
      allowed: false,
      warning: `Ignored ${edge.edgeType} resolution without user-confirmation authority: ${edgeLabel(edge)}`
    };
  }

  if (edge.edgeType === "supersedes") {
    return claimEdgeCanBlockCurrentValid(edge);
  }

  return { allowed: false };
}

function isLegacyAuthority(authority: ClaimEdgeAuthoritySummary): boolean {
  return authority.createdBy === "legacy" || !authority.recorded;
}

function boundedConfidence(confidence: number | undefined): number {
  if (confidence === undefined || !Number.isFinite(confidence)) return 0;
  if (confidence < 0) return 0;
  if (confidence > 1) return 1;
  return confidence;
}

function edgeLabel(edge: ClaimEdgeAuthorityPolicyEdge): string {
  return edge.edgeId ?? `${edge.sourceClaimId} -> ${edge.targetClaimId}`;
}
