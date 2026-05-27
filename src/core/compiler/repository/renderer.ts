import type { InMemoryContextArtifactShape } from "../../../shared/index.js";
import type { RepositoryContextRenderInput } from "./render-types.js";

export { renderRepositoryContextPackMarkdown } from "./markdown/context-pack.js";
export type {
  RepositoryContextRenderInput,
  RepositoryContextRenderTokenMetric
} from "./render-types.js";

export function renderRepositoryContextPackJson(input: RepositoryContextRenderInput): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      artifactFormat: "grape.context-pack.v1",
      artifactFormatVersion: input.contextArtifact.artifactFormatVersion,
      contextArtifact: input.contextArtifact,
      contextPackItemShape: "ContextPackItem",
      contextPackItems: input.contextPackItems,
      omittedItems: input.omittedItems,
      tokenMetric: input.tokenMetric,
      budget: input.budget
    },
    null,
    2
  )}\n`;
}

export function renderRepositoryScaffoldArtifactJson(artifact: InMemoryContextArtifactShape): string {
  return `${JSON.stringify(
    {
      artifactShape: "InMemoryContextArtifactShape",
      artifact
    },
    null,
    2
  )}\n`;
}
