import { randomUUID } from "node:crypto";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { InMemoryContextArtifactShape } from "../../../shared/index.js";

export interface LocalArtifactWriteInput {
  readonly artifactDirPath: string;
  readonly artifact: InMemoryContextArtifactShape;
  readonly json: string;
  readonly markdown: string;
  readonly scaffoldJson: string;
}

export interface LocalArtifactWriteResult {
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly scaffoldJsonPath: string;
}

export function writeLocalArtifactFiles(input: LocalArtifactWriteInput): LocalArtifactWriteResult {
  const baseName = artifactFileBaseName(input.artifact.artifactId);
  const jsonPath = path.join(input.artifactDirPath, `${baseName}.json`);
  const markdownPath = path.join(input.artifactDirPath, `${baseName}.md`);
  const scaffoldJsonPath = path.join(input.artifactDirPath, `${baseName}.scaffold.json`);
  const tempSuffix = `.tmp-${process.pid}-${randomUUID()}`;
  const writes = [
    { finalPath: jsonPath, tempPath: `${jsonPath}${tempSuffix}`, body: input.json },
    { finalPath: markdownPath, tempPath: `${markdownPath}${tempSuffix}`, body: input.markdown },
    { finalPath: scaffoldJsonPath, tempPath: `${scaffoldJsonPath}${tempSuffix}`, body: input.scaffoldJson }
  ];

  try {
    for (const write of writes) {
      writeFileSync(write.tempPath, write.body);
    }
    for (const write of writes) {
      renameSync(write.tempPath, write.finalPath);
    }
  } finally {
    for (const write of writes) {
      rmSync(write.tempPath, { force: true });
    }
  }

  return { jsonPath, markdownPath, scaffoldJsonPath };
}

export function artifactFileBaseName(artifactId: string): string {
  return `ctx_${artifactId.replace(/^artifact:/, "").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
