import {
  claimScopesCompatibleForSupersession,
  claimScopesOverlap
} from "../scope/index.js";
import {
  claimEdgeCanBlockCurrentValid,
  claimEdgeCanResolveConflict,
  type ClaimEdgeAuthorityMetadata
} from "./claim-edge-authority.js";

export interface ClaimEdgePolicyClaim {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly scope: Readonly<Record<string, unknown>>;
}

export interface ClaimEdgePolicyEdge {
  readonly edgeId?: string;
  readonly sourceClaimId: string;
  readonly targetClaimId: string;
  readonly edgeType: string;
  readonly authority?: ClaimEdgeAuthorityMetadata;
  readonly createdAt: string;
}

export interface ActiveClaimEdgeBlockResult {
  readonly blockedClaimIds: ReadonlySet<string>;
  readonly ignoredEdges: readonly ClaimEdgePolicyEdge[];
  readonly warnings: readonly string[];
}

const conflictClosingEdgeTypes = new Set(["coexists_with", "variant_of"]);
const supersedesClosingEdgeTypes = new Set(["coexists_with", "variant_of"]);

export function claimIdsBlockedByActiveClaimEdges(input: {
  readonly claims: readonly ClaimEdgePolicyClaim[];
  readonly edges: readonly ClaimEdgePolicyEdge[];
}): ActiveClaimEdgeBlockResult {
  const claimsById = new Map(input.claims.map((claim) => [claim.claimId, claim]));
  const blocked = new Set<string>();
  const ignoredEdges: ClaimEdgePolicyEdge[] = [];
  const warnings: string[] = [];

  for (const edge of input.edges) {
    if (edge.edgeType === "contradicts" && !hasLaterResolution(edge, input.edges, conflictClosingEdgeTypes, warnings)) {
      const authority = claimEdgeCanBlockCurrentValid(edge);
      if (authority.warning) warnings.push(authority.warning);
      if (!authority.allowed) continue;
      blockIfScopesMayConflict({
        edge,
        sourceClaim: claimsById.get(edge.sourceClaimId),
        targetClaim: claimsById.get(edge.targetClaimId),
        blocked,
        warnings
      });
      continue;
    }
    if (edge.edgeType === "violates" && !hasLaterResolution(edge, input.edges, conflictClosingEdgeTypes, warnings)) {
      const authority = claimEdgeCanBlockCurrentValid(edge);
      if (authority.warning) warnings.push(authority.warning);
      if (!authority.allowed) continue;
      blockViolatingClaimIfScopesMayConflict({
        edge,
        sourceClaim: claimsById.get(edge.sourceClaimId),
        targetClaim: claimsById.get(edge.targetClaimId),
        blocked,
        warnings
      });
      continue;
    }
    if (edge.edgeType !== "supersedes" || hasLaterResolution(edge, input.edges, supersedesClosingEdgeTypes, warnings)) {
      continue;
    }

    const authority = claimEdgeCanBlockCurrentValid(edge);
    if (authority.warning) warnings.push(authority.warning);
    if (!authority.allowed) {
      ignoredEdges.push(edge);
      continue;
    }

    const sourceClaim = claimsById.get(edge.sourceClaimId);
    const targetClaim = claimsById.get(edge.targetClaimId);
    if (sourceClaim && targetClaim && canSupersedeClaim(sourceClaim, targetClaim)) {
      blocked.add(edge.targetClaimId);
    } else {
      ignoredEdges.push(edge);
      warnings.push(
        `Ignored supersedes edge without compatible claim subject, type, and scope: ${edge.sourceClaimId} -> ${edge.targetClaimId}`
      );
    }
  }

  return { blockedClaimIds: blocked, ignoredEdges, warnings };
}

export function canSupersedeClaim(sourceClaim: ClaimEdgePolicyClaim, targetClaim: ClaimEdgePolicyClaim): boolean {
  return (
    sourceClaim.claimType === targetClaim.claimType &&
    sourceClaim.subject === targetClaim.subject &&
    claimScopesCompatibleForSupersession(sourceClaim.scope, targetClaim.scope).status === "overlap"
  );
}

function blockIfScopesMayConflict(input: {
  readonly edge: ClaimEdgePolicyEdge;
  readonly sourceClaim: ClaimEdgePolicyClaim | undefined;
  readonly targetClaim: ClaimEdgePolicyClaim | undefined;
  readonly blocked: Set<string>;
  readonly warnings: string[];
}): void {
  const overlap = activeEdgeScopeOverlap(input);
  if (overlap === "disjoint") return;
  input.blocked.add(input.edge.sourceClaimId);
  input.blocked.add(input.edge.targetClaimId);
}

function blockViolatingClaimIfScopesMayConflict(input: {
  readonly edge: ClaimEdgePolicyEdge;
  readonly sourceClaim: ClaimEdgePolicyClaim | undefined;
  readonly targetClaim: ClaimEdgePolicyClaim | undefined;
  readonly blocked: Set<string>;
  readonly warnings: string[];
}): void {
  const overlap = activeEdgeScopeOverlap(input);
  if (overlap === "disjoint") return;
  input.blocked.add(input.edge.sourceClaimId);
}

function activeEdgeScopeOverlap(input: {
  readonly edge: ClaimEdgePolicyEdge;
  readonly sourceClaim: ClaimEdgePolicyClaim | undefined;
  readonly targetClaim: ClaimEdgePolicyClaim | undefined;
  readonly warnings: string[];
}): "overlap" | "disjoint" | "unknown" {
  if (!input.sourceClaim || !input.targetClaim) {
    input.warnings.push(
      `Claim edge has unknown scope because a linked claim is unavailable: ${input.edge.sourceClaimId} -> ${input.edge.targetClaimId}`
    );
    return "unknown";
  }
  const overlap = claimScopesOverlap(input.sourceClaim.scope, input.targetClaim.scope);
  if (overlap.status === "unknown") {
    input.warnings.push(
      `Claim edge has unknown scope overlap and remains blocking: ${input.edge.sourceClaimId} -> ${input.edge.targetClaimId}`
    );
  }
  return overlap.status;
}

function hasLaterResolution(
  edge: ClaimEdgePolicyEdge,
  edges: readonly ClaimEdgePolicyEdge[],
  resolutionTypes: ReadonlySet<string>,
  warnings: string[]
): boolean {
  let resolved = false;
  for (const candidate of edges) {
    if (
      !resolutionTypes.has(candidate.edgeType) ||
      claimPairKey(candidate) !== claimPairKey(edge) ||
      candidate.createdAt <= edge.createdAt
    ) {
      continue;
    }
    const authority = claimEdgeCanResolveConflict(candidate);
    if (authority.warning) warnings.push(authority.warning);
    if (authority.allowed) resolved = true;
  }
  return resolved;
}

function claimPairKey(edge: Pick<ClaimEdgePolicyEdge, "sourceClaimId" | "targetClaimId">): string {
  return [edge.sourceClaimId, edge.targetClaimId].sort().join("\0");
}
