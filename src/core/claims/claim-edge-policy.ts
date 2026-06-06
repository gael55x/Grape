export interface ClaimEdgePolicyClaim {
  readonly claimId: string;
  readonly subject: string;
  readonly claimType: string;
  readonly scope: Readonly<Record<string, unknown>>;
}

export interface ClaimEdgePolicyEdge {
  readonly sourceClaimId: string;
  readonly targetClaimId: string;
  readonly edgeType: string;
  readonly createdAt: string;
}

export interface ActiveClaimEdgeBlockResult {
  readonly blockedClaimIds: ReadonlySet<string>;
  readonly ignoredEdges: readonly ClaimEdgePolicyEdge[];
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

  for (const edge of input.edges) {
    if (edge.edgeType === "contradicts" && !hasLaterResolution(edge, input.edges, conflictClosingEdgeTypes)) {
      blocked.add(edge.sourceClaimId);
      blocked.add(edge.targetClaimId);
      continue;
    }
    if (edge.edgeType === "violates" && !hasLaterResolution(edge, input.edges, conflictClosingEdgeTypes)) {
      blocked.add(edge.sourceClaimId);
      continue;
    }
    if (edge.edgeType !== "supersedes" || hasLaterResolution(edge, input.edges, supersedesClosingEdgeTypes)) {
      continue;
    }

    const sourceClaim = claimsById.get(edge.sourceClaimId);
    const targetClaim = claimsById.get(edge.targetClaimId);
    if (sourceClaim && targetClaim && canSupersedeClaim(sourceClaim, targetClaim)) {
      blocked.add(edge.targetClaimId);
    } else {
      ignoredEdges.push(edge);
    }
  }

  return { blockedClaimIds: blocked, ignoredEdges };
}

export function canSupersedeClaim(sourceClaim: ClaimEdgePolicyClaim, targetClaim: ClaimEdgePolicyClaim): boolean {
  return (
    sourceClaim.claimType === targetClaim.claimType &&
    sourceClaim.subject === targetClaim.subject &&
    stringScope(sourceClaim.scope, "branch") !== "" &&
    stringScope(sourceClaim.scope, "branch") === stringScope(targetClaim.scope, "branch") &&
    sameOptionalScopeValue(sourceClaim.scope, targetClaim.scope, "environment") &&
    sameOptionalScopeObject(sourceClaim.scope, targetClaim.scope, "featureFlags") &&
    sameRequiredScopeValue(sourceClaim.scope, targetClaim.scope, "sourceRef")
  );
}

function sameRequiredScopeValue(
  sourceScope: Readonly<Record<string, unknown>>,
  targetScope: Readonly<Record<string, unknown>>,
  key: string
): boolean {
  const sourceValue = stringScope(sourceScope, key);
  return sourceValue !== "" && sourceValue === stringScope(targetScope, key);
}

function sameOptionalScopeValue(
  sourceScope: Readonly<Record<string, unknown>>,
  targetScope: Readonly<Record<string, unknown>>,
  key: string
): boolean {
  const sourceValue = sourceScope[key];
  const targetValue = targetScope[key];
  if (sourceValue === undefined && targetValue === undefined) return true;
  return typeof sourceValue === "string" && sourceValue === targetValue;
}

function sameOptionalScopeObject(
  sourceScope: Readonly<Record<string, unknown>>,
  targetScope: Readonly<Record<string, unknown>>,
  key: string
): boolean {
  const sourceValue = sourceScope[key];
  const targetValue = targetScope[key];
  if (sourceValue === undefined && targetValue === undefined) return true;
  return stableJson(sourceValue) === stableJson(targetValue);
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return JSON.stringify(
    Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))
  );
}

function hasLaterResolution(
  edge: ClaimEdgePolicyEdge,
  edges: readonly ClaimEdgePolicyEdge[],
  resolutionTypes: ReadonlySet<string>
): boolean {
  return edges.some(
    (candidate) =>
      resolutionTypes.has(candidate.edgeType) &&
      claimPairKey(candidate) === claimPairKey(edge) &&
      candidate.createdAt > edge.createdAt
  );
}

function claimPairKey(edge: Pick<ClaimEdgePolicyEdge, "sourceClaimId" | "targetClaimId">): string {
  return [edge.sourceClaimId, edge.targetClaimId].sort().join("\0");
}

function stringScope(scope: Readonly<Record<string, unknown>>, key: string): string {
  const value = scope[key];
  return typeof value === "string" ? value : "";
}
