import type {
  InMemoryContextDependencyShape,
  InMemoryContextSectionShape
} from "../../../../shared/index.js";
import { activeClaimsSection } from "./builders/active-claims.js";
import { activeProjectRulesSection } from "./builders/project-rules.js";
import { blindSpotSection } from "./builders/blind-spots.js";
import { compressionArtifactsSection } from "./builders/compression.js";
import { exactSourceEvidenceSection } from "./builders/source-evidence.js";
import { repositoryStateSection } from "./builders/repository-state.js";
import { sourceManifestSection } from "./builders/source-manifest.js";
import { symbolSummarySection } from "./builders/symbol-summary.js";
import { taskRetrievalSection } from "./builders/task-retrieval.js";
import { taskSection } from "./builders/task.js";
import type { CompileRepositoryContextArtifactInput } from "../types.js";

export function contextSections(
  input: CompileRepositoryContextArtifactInput,
  dependencies: readonly InMemoryContextDependencyShape[]
): InMemoryContextSectionShape[] {
  return compactSections([
    taskSection(input),
    taskRetrievalSection(input, dependencies),
    repositoryStateSection(input),
    sourceManifestSection(input, dependencies),
    activeProjectRulesSection(input, dependencies),
    activeClaimsSection(input, dependencies),
    compressionArtifactsSection(input, dependencies),
    exactSourceEvidenceSection(input, dependencies),
    symbolSummarySection(input, dependencies),
    blindSpotSection(input)
  ]);
}

function compactSections(
  sections: readonly (InMemoryContextSectionShape | undefined)[]
): InMemoryContextSectionShape[] {
  return sections.filter((section): section is InMemoryContextSectionShape => section !== undefined);
}
