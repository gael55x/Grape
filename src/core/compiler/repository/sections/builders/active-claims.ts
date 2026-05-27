import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { claimDependencyId } from "../../manifest/dependencies.js";
import { repositoryContextSection as section } from "../factory.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";
import { sourceProofDependencyId } from "../../proofs/source-proofs.js";

export function activeClaimsSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape | undefined {
  const claims = input.activeClaims ?? [];
  if (claims.length === 0) return undefined;

  return section({
    id: "current-valid-claims",
    type: "active_claim",
    title: "Current Valid Claims",
    body: activeClaimsBody(claims),
    sourceRefs: [...new Set(claims.flatMap((claim) => claim.sourceRefs))],
    proofRefs: [...new Set(claims.flatMap((claim) => claim.proofRefs))],
    dependencyRefs: activeClaimDependencyRefs(claims, dependencies),
    pinned: false,
    exactRequired: true
  });
}

function activeClaimDependencyRefs(
  claims: NonNullable<CompileRepositoryContextArtifactInput["activeClaims"]>,
  dependencies: readonly InMemoryContextDependencyShape[]
): string[] {
  const dependencyIds = new Set(dependencies.map((dependency) => dependency.id));
  return [
    ...new Set(
      claims
        .flatMap((claim) => [
          claimDependencyId(claim.claimId),
          ...claim.proofRefs.map((proofRef) => sourceProofDependencyId(proofRef))
        ])
        .filter((dependencyRef) => dependencyIds.has(dependencyRef))
    )
  ];
}

function activeClaimsBody(
  claims: NonNullable<CompileRepositoryContextArtifactInput["activeClaims"]>
): string {
  return claims
    .map((claim) =>
      [
        `Claim: ${claim.claimId}`,
        `Type: ${claim.claimType}`,
        `Proofs: ${claim.proofRefs.join(", ")}`,
        `Sources: ${claim.sourceRefs.join(", ")}`,
        claim.claimText
      ].join("\n")
    )
    .join("\n\n");
}
