import type { InMemoryContextSectionShape } from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import { preferredSourceRefs } from "../task-selection.js";
import { selectedSymbolNodes } from "../../selection/index.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function blindSpotSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  const fallbackLanguages = selectedFallbackLanguages(input);

  return section({
    id: "index-blind-spots",
    type: "stale_warning",
    title: "Index Confidence",
    body: [
      "This artifact uses the lightweight file index.",
      "It is an impact candidate set, not a complete call graph.",
      ...fallbackLanguageLines(fallbackLanguages),
      "Regex import/symbol extraction can miss dynamic imports, framework routing, dependency injection, and generated code.",
      "No durable claims are promoted from this artifact without proof validation."
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: input.taskType === "refactor" || input.riskOverlays.length > 0,
    exactRequired: false
  });
}

function selectedFallbackLanguages(input: CompileRepositoryContextArtifactInput): readonly string[] {
  const preferredRefs = preferredSourceRefs(input);
  const languages = new Set<string>();
  for (const node of selectedSymbolNodes(input.symbolNodes, preferredRefs)) {
    if (node.language === "typescript" || node.language === "typescript_tsx") continue;
    if (node.language === "javascript" || node.language === "javascript_jsx") continue;
    languages.add(node.language);
  }
  return [...languages].sort();
}

function fallbackLanguageLines(languages: readonly string[]): readonly string[] {
  if (languages.length === 0) return [];
  return [
    `Generic text fallback selected languages: ${languages.join(", ")}.`,
    "Fallback can quote exact spans and match paths or text. It does not prove module edges, test edges, framework routes, types, or runtime behavior."
  ];
}
