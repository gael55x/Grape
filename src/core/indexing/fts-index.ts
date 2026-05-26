import type { SourceType } from "../../shared/index.js";
import { scanTextForSecrets } from "../security/index.js";
import type { SourceRecord } from "../storage/index.js";
import { hashStableParts, sha256 } from "./index-hash.js";
import {
  readIndexableText,
  type IndexableTextSkipReason
} from "./indexable-source-reader.js";

export interface FtsIndexInput {
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly rootPath: string;
  readonly sources: readonly SourceRecord[];
  readonly createdAt: string;
}

export interface FtsIndexEntry {
  readonly ftsEntryId: string;
  readonly projectId: string;
  readonly repoId: string;
  readonly snapshotId: string;
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceType: SourceType;
  readonly sourceHash: string;
  readonly textHash: string;
  readonly body: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface FtsIndexResult {
  readonly entries: readonly FtsIndexEntry[];
  readonly skipped: readonly FtsIndexSkip[];
}

export interface FtsIndexSkip {
  readonly sourceRef: string;
  readonly reason: IndexableTextSkipReason | "unsupported_source" | "secret_detected";
}

const ftsSourceTypes = new Set<SourceType>([
  "repository_file",
  "rule_file",
  "config_file",
  "lockfile",
  "migration_file"
]);

export function buildFtsIndex(input: FtsIndexInput): FtsIndexResult {
  const entries: FtsIndexEntry[] = [];
  const skipped: FtsIndexSkip[] = [];

  for (const source of input.sources) {
    if (!sourceCanBeIndexed(source)) {
      skipped.push({ sourceRef: source.sourceRef, reason: "unsupported_source" });
      continue;
    }

    const readResult = readIndexableText(input.rootPath, {
      path: source.sourceRef,
      sha256: source.sourceHash
    });
    if (readResult.status === "skipped") {
      skipped.push({ sourceRef: source.sourceRef, reason: readResult.reason });
      continue;
    }

    if (!scanTextForSecrets(readResult.text).ok) {
      skipped.push({ sourceRef: source.sourceRef, reason: "secret_detected" });
      continue;
    }

    entries.push(ftsEntry(input, source, readResult.text));
  }

  return { entries, skipped };
}

function sourceCanBeIndexed(source: SourceRecord): boolean {
  return (
    source.trustClass === "trusted" &&
    source.privacyStatus === "allowed" &&
    source.redactionStatus !== "blocked" &&
    ftsSourceTypes.has(source.sourceType)
  );
}

function ftsEntry(input: FtsIndexInput, source: SourceRecord, body: string): FtsIndexEntry {
  const textHash = sha256(Buffer.from(body, "utf8"));
  return {
    ftsEntryId: `fts:${hashStableParts([input.repoId, input.snapshotId, source.sourceId, source.sourceHash]).slice(0, 24)}`,
    projectId: input.projectId,
    repoId: input.repoId,
    snapshotId: input.snapshotId,
    sourceId: source.sourceId,
    sourceRef: source.sourceRef,
    sourceType: source.sourceType,
    sourceHash: source.sourceHash,
    textHash,
    body,
    metadata: {
      extractor: "fts_v1",
      sourceScope: source.sourceScope
    },
    createdAt: input.createdAt
  };
}
