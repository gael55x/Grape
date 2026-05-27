import type { InMemoryContextSectionShape } from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function repositoryStateSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  return section({
    id: "repo-state",
    type: "risk_warning",
    title: "Repository State",
    body: [
      `Branch: ${input.snapshot.branch}`,
      `Commit: ${input.snapshot.commit}`,
      `Worktree: ${input.snapshot.worktreeStatus}`,
      `Dirty paths: ${input.snapshot.dirtyPaths.length}`,
      ...input.snapshot.dirtyPaths.slice(0, 20).map((repoPath) => `- ${repoPath}`)
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: true,
    exactRequired: false
  });
}
