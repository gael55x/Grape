import { existsSync, lstatSync, rmSync } from "node:fs";
import path from "node:path";

import { artifactFileBaseName } from "../context/artifact-files.js";

export interface ArtifactFileCandidate {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly bytes: number;
  readonly status: "delete" | "missing" | "unsafe";
  readonly unsafeReason?: string;
}

export function planArtifactFiles(input: {
  readonly rootPath: string;
  readonly artifactDirPath: string;
  readonly artifactIds: readonly string[];
}): ArtifactFileCandidate[] {
  const files: ArtifactFileCandidate[] = [];
  for (const artifactId of input.artifactIds) {
    const baseName = artifactFileBaseName(artifactId);
    for (const suffix of [".json", ".md", ".repository.json"]) {
      const absolutePath = path.join(input.artifactDirPath, `${baseName}${suffix}`);
      const relativePath = repoRelativePath(input.rootPath, absolutePath);
      assertInsideDirectory(input.artifactDirPath, absolutePath);

      if (!existsSync(absolutePath)) {
        files.push({ absolutePath, relativePath, bytes: 0, status: "missing" });
        continue;
      }

      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        files.push({
          absolutePath,
          relativePath,
          bytes: 0,
          status: "unsafe",
          unsafeReason: "symlink"
        });
        continue;
      }
      if (!stat.isFile()) {
        files.push({
          absolutePath,
          relativePath,
          bytes: 0,
          status: "unsafe",
          unsafeReason: "not_regular_file"
        });
        continue;
      }

      files.push({
        absolutePath,
        relativePath,
        bytes: stat.size,
        status: "delete"
      });
    }
  }
  return files;
}

export function summarizeArtifactFiles(files: readonly ArtifactFileCandidate[]): {
  readonly plannedFiles: number;
  readonly plannedBytes: number;
  readonly skippedUnsafeFiles: number;
  readonly skippedMissingFiles: number;
} {
  return {
    plannedFiles: files.filter((file) => file.status === "delete").length,
    plannedBytes: files.reduce((total, file) => (file.status === "delete" ? total + file.bytes : total), 0),
    skippedUnsafeFiles: files.filter((file) => file.status === "unsafe").length,
    skippedMissingFiles: files.filter((file) => file.status === "missing").length
  };
}

export function deletePlannedArtifactFiles(files: readonly ArtifactFileCandidate[]): {
  readonly deletedFiles: number;
  readonly deletedBytes: number;
} {
  let deletedFiles = 0;
  let deletedBytes = 0;
  for (const file of files) {
    if (file.status !== "delete") continue;
    rmSync(file.absolutePath, { force: true });
    deletedFiles += 1;
    deletedBytes += file.bytes;
  }
  return { deletedFiles, deletedBytes };
}

function assertInsideDirectory(directoryPath: string, filePath: string): void {
  const relative = path.relative(directoryPath, filePath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("refusing to touch an artifact file outside .grape/artifacts.");
  }
}

function repoRelativePath(rootPath: string, filePath: string): string {
  return path.relative(rootPath, filePath).split(path.sep).join("/");
}
