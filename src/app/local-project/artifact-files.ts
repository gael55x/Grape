import { writeFileSync } from "node:fs";
import path from "node:path";

import type { InMemoryContextArtifactShape } from "../../shared/index.js";

export interface LocalArtifactWriteInput {
  readonly artifactDirPath: string;
  readonly artifact: InMemoryContextArtifactShape;
  readonly json: string;
  readonly markdown: string;
}

export interface LocalArtifactWriteResult {
  readonly jsonPath: string;
  readonly markdownPath: string;
}

export function writeLocalArtifactFiles(input: LocalArtifactWriteInput): LocalArtifactWriteResult {
  const baseName = artifactFileBaseName(input.artifact.artifactId);
  const jsonPath = path.join(input.artifactDirPath, `${baseName}.json`);
  const markdownPath = path.join(input.artifactDirPath, `${baseName}.md`);

  writeFileSync(jsonPath, input.json);
  writeFileSync(markdownPath, input.markdown);

  return { jsonPath, markdownPath };
}

function artifactFileBaseName(artifactId: string): string {
  return `ctx_${artifactId.replace(/^artifact:/, "").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
