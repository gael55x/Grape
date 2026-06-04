import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../../shared/index.js";
import { selectedRuleSourceExcerpts } from "../../selection/index.js";
import { sourceProofDependencyId, sourceProofRefs } from "../../proofs/source-proofs.js";
import { repositoryContextSection as section } from "../factory.js";
import { sectionDependencyRefs, sourceDependencyRefForSourceRef } from "../dependencies.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";
import { fencedUntrustedEvidence } from "../untrusted-evidence.js";

export function activeProjectRulesSection(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape | undefined {
  const ruleExcerpts = selectedRuleSourceExcerpts(input.sourceExcerpts);
  if (ruleExcerpts.length === 0) return undefined;

  return section({
    id: "active-project-rules",
    type: "pinned_rule",
    title: "Active Project Rules",
    body: activeProjectRulesBody(ruleExcerpts),
    sourceRefs: ruleExcerpts.map((excerpt) => excerpt.sourceRef),
    proofRefs: sourceProofRefs(ruleExcerpts),
    dependencyRefs: sectionDependencyRefs(
      ["repo-snapshot", "worktree-state"],
      [
        ...ruleExcerpts.map((excerpt) => sourceDependencyRefForSourceRef(excerpt.sourceRef, dependencies)),
        ...ruleExcerpts.map((excerpt) => sourceProofDependencyId(excerpt.proofId))
      ].filter((ref): ref is string => Boolean(ref))
    ),
    pinned: true,
    exactRequired: true
  });
}

function activeProjectRulesBody(
  excerpts: ReturnType<typeof selectedRuleSourceExcerpts>
): string {
  return excerpts
    .map((excerpt) =>
      [
        `Rule source: ${excerpt.sourceRef}`,
        `Scope: ${excerpt.sourceScope}`,
        `Proof: ${excerpt.proofId}`,
        `Source hash: ${excerpt.sourceHash}`,
        `Excerpt hash: ${excerpt.excerptHash}`,
        fencedUntrustedEvidence("Rule excerpt", excerpt.excerpt)
      ].join("\n")
    )
    .join("\n\n");
}
