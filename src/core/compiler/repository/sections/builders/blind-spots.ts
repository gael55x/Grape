import type { InMemoryContextSectionShape } from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function blindSpotSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  return section({
    id: "index-blind-spots",
    type: "stale_warning",
    title: "Index Confidence",
    body: [
      "This artifact uses the V1 lightweight file index.",
      "It is an impact candidate set, not a complete call graph.",
      "Regex import/symbol extraction can miss dynamic imports, framework routing, dependency injection, and generated code.",
      "No durable claims are promoted from this artifact without proof validation."
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: input.taskType === "refactor" || input.riskOverlays.length > 0,
    exactRequired: false
  });
}
