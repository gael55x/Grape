import type { InMemoryContextSectionShape } from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function taskSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  return section({
    id: "task",
    type: "task",
    title: "Task Context",
    body: [
      `Task type: ${input.taskType}`,
      `Task id: ${input.taskId}`,
      `Risk overlays: ${input.riskOverlays.length > 0 ? input.riskOverlays.join(", ") : "none"}`
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: false,
    exactRequired: false
  });
}
