import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { selectedPolicyExactSourceExcerpts } from "../../policy/risk.js";
import { sourceProofDependencyId, sourceProofRefs } from "../../proofs/source-proofs.js";
import { repositoryContextSection as section } from "../factory.js";
import { sectionDependencyRefs, sourceDependencyRefForSourceRef } from "../dependencies.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";
import { fencedUntrustedEvidence } from "../untrusted-evidence.js";

export function exactSourceEvidenceSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape {
  const excerpts = selectedPolicyExactSourceExcerpts(input);
  return section({
    id: "exact-source-evidence",
    type: "code_span",
    title: "Exact Source Evidence",
    body: exactSourceEvidenceBody(excerpts),
    sourceRefs: excerpts.map((excerpt) => excerpt.sourceRef),
    proofRefs: sourceProofRefs(excerpts),
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      [
        ...excerpts.map((excerpt) => sourceDependencyRefForSourceRef(excerpt.sourceRef, dependencies)),
        ...excerpts.map((excerpt) => sourceProofDependencyId(excerpt.proofId))
      ].filter((ref): ref is string => Boolean(ref))
    ),
    pinned: false,
    exactRequired: excerpts.length > 0
  });
}

function exactSourceEvidenceBody(
  excerpts: ReturnType<typeof selectedPolicyExactSourceExcerpts>
): string {
  if (excerpts.length === 0) {
    return [
      "No exact source excerpts were selected for this repository artifact.",
      "Use source manifest and relationship sections for orientation only."
    ].join("\n");
  }

  return excerpts
    .map((excerpt) =>
      [
        `Source: ${excerpt.sourceRef}`,
        `Type: ${excerpt.sourceType}`,
        `Scope: ${excerpt.sourceScope}`,
        `Lines: ${excerpt.startLine}-${excerpt.endLine}${excerpt.truncated ? " (truncated)" : ""}`,
        `Proof: ${excerpt.proofId}`,
        `Source hash: ${excerpt.sourceHash}`,
        `Excerpt hash: ${excerpt.excerptHash}`,
        fencedUntrustedEvidence("Excerpt", excerpt.excerpt)
      ].join("\n")
    )
    .join("\n\n");
}
