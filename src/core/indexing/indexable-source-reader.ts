import { lstatSync, readFileSync } from "node:fs";

import { sha256 } from "./index-hash.js";
import { safeAbsolutePath } from "./index-paths.js";

export type IndexableTextSkipReason =
  | "too_large"
  | "binary"
  | "unreadable"
  | "symlink"
  | "hash_mismatch";

export interface IndexableTextSource {
  readonly path: string;
  readonly sha256: string;
}

export type IndexableTextReadResult =
  | {
      readonly status: "ok";
      readonly text: string;
    }
  | {
      readonly status: "skipped";
      readonly reason: IndexableTextSkipReason;
    };

const maxIndexedBytes = 512 * 1024;

export function readIndexableText(
  rootPath: string,
  file: IndexableTextSource
): IndexableTextReadResult {
  try {
    const absolutePath = safeAbsolutePath(rootPath, file.path);
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) return { status: "skipped", reason: "symlink" };
    if (stat.size > maxIndexedBytes) return { status: "skipped", reason: "too_large" };

    const bytes = readFileSync(absolutePath);
    if (bytes.includes(0)) return { status: "skipped", reason: "binary" };
    if (sha256(bytes) !== file.sha256) return { status: "skipped", reason: "hash_mismatch" };

    return { status: "ok", text: bytes.toString("utf8") };
  } catch {
    return { status: "skipped", reason: "unreadable" };
  }
}
