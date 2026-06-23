import { existsSync, lstatSync, readdirSync, type Dirent } from "node:fs";
import path from "node:path";

export interface StorageFootprint {
  readonly grapeBytes: number;
  readonly databaseBytes: number;
  readonly databaseWalBytes: number;
  readonly databaseShmBytes: number;
  readonly artifactBytes: number;
  readonly artifactJsonBytes: number;
  readonly artifactMarkdownBytes: number;
  readonly artifactRepositoryBytes: number;
  readonly artifactOtherBytes: number;
  readonly otherBytes: number;
}

export interface StorageFootprintReport {
  readonly before: StorageFootprint;
  readonly after: StorageFootprint;
  readonly delta: StorageFootprint;
  readonly afterMeasuredPostApply: boolean;
}

export function measureStorageFootprint(input: {
  readonly grapeDirPath: string;
  readonly databasePath: string;
  readonly artifactDirPath: string;
}): StorageFootprint {
  const grapeBytes = directoryBytes(input.grapeDirPath);
  const databaseBytes = fileBytes(input.databasePath);
  const databaseWalBytes = fileBytes(`${input.databasePath}-wal`);
  const databaseShmBytes = fileBytes(`${input.databasePath}-shm`);
  const artifact = artifactBytes(input.artifactDirPath);
  const otherBytes = Math.max(
    0,
    grapeBytes - databaseBytes - databaseWalBytes - databaseShmBytes - artifact.total
  );

  return {
    grapeBytes,
    databaseBytes,
    databaseWalBytes,
    databaseShmBytes,
    artifactBytes: artifact.total,
    artifactJsonBytes: artifact.json,
    artifactMarkdownBytes: artifact.markdown,
    artifactRepositoryBytes: artifact.repository,
    artifactOtherBytes: artifact.other,
    otherBytes
  };
}

export function storageFootprintReport(input: {
  readonly before: StorageFootprint;
  readonly after: StorageFootprint;
  readonly afterMeasuredPostApply: boolean;
}): StorageFootprintReport {
  return {
    before: input.before,
    after: input.after,
    delta: subtractFootprint(input.after, input.before),
    afterMeasuredPostApply: input.afterMeasuredPostApply
  };
}

function artifactBytes(artifactDirPath: string): {
  readonly total: number;
  readonly json: number;
  readonly markdown: number;
  readonly repository: number;
  readonly other: number;
} {
  let total = 0;
  let json = 0;
  let markdown = 0;
  let repository = 0;
  let other = 0;

  visitFiles(artifactDirPath, (filePath, bytes) => {
    total += bytes;
    const baseName = path.basename(filePath);
    if (baseName.endsWith(".repository.json")) {
      repository += bytes;
    } else if (baseName.endsWith(".json")) {
      json += bytes;
    } else if (baseName.endsWith(".md")) {
      markdown += bytes;
    } else {
      other += bytes;
    }
  });

  return { total, json, markdown, repository, other };
}

function directoryBytes(directoryPath: string): number {
  let total = 0;
  visitFiles(directoryPath, (_filePath, bytes) => {
    total += bytes;
  });
  return total;
}

function fileBytes(filePath: string): number {
  try {
    if (!existsSync(filePath)) return 0;
    const stat = lstatSync(filePath);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
}

function visitFiles(directoryPath: string, visit: (filePath: string, bytes: number) => void): void {
  let entries: Dirent<string>[];
  try {
    if (!existsSync(directoryPath)) return;
    entries = readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      visitFiles(absolutePath, visit);
      continue;
    }
    if (!entry.isFile()) continue;

    const bytes = fileBytes(absolutePath);
    if (bytes > 0) visit(absolutePath, bytes);
  }
}

function subtractFootprint(left: StorageFootprint, right: StorageFootprint): StorageFootprint {
  return {
    grapeBytes: left.grapeBytes - right.grapeBytes,
    databaseBytes: left.databaseBytes - right.databaseBytes,
    databaseWalBytes: left.databaseWalBytes - right.databaseWalBytes,
    databaseShmBytes: left.databaseShmBytes - right.databaseShmBytes,
    artifactBytes: left.artifactBytes - right.artifactBytes,
    artifactJsonBytes: left.artifactJsonBytes - right.artifactJsonBytes,
    artifactMarkdownBytes: left.artifactMarkdownBytes - right.artifactMarkdownBytes,
    artifactRepositoryBytes: left.artifactRepositoryBytes - right.artifactRepositoryBytes,
    artifactOtherBytes: left.artifactOtherBytes - right.artifactOtherBytes,
    otherBytes: left.otherBytes - right.otherBytes
  };
}
