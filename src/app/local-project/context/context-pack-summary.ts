import type {
  ContextSentItemRecord,
  StorageRepositories
} from "../../../core/storage/index.js";
import type { ContextPackSummarySentItemInput } from "../../../core/compression/index.js";

export interface ListContextPackSummarySentItemsInput {
  readonly repositories: StorageRepositories;
  readonly sessionId: string;
  readonly branch: string;
  readonly commit: string;
}

export function listContextPackSummarySentItems(
  input: ListContextPackSummarySentItemsInput
): readonly ContextPackSummarySentItemInput[] {
  return latestContextPackSummarySentItems(
    input.repositories.contextSentItems.listActiveBySessionScope({
      sessionId: input.sessionId,
      branchName: input.branch,
      commitSha: input.commit,
      excludedKind: "compression_artifact"
    })
  );
}

function latestContextPackSummarySentItems(
  sentItems: readonly ContextSentItemRecord[]
): readonly ContextPackSummarySentItemInput[] {
  const latestBySection = new Map<string, ContextSentItemRecord>();

  for (const item of sentItems) {
    const previous = latestBySection.get(item.sectionId);
    if (!previous || compareSentItems(item, previous) > 0) {
      latestBySection.set(item.sectionId, item);
    }
  }

  return [...latestBySection.values()]
    .sort((left, right) => left.sectionId.localeCompare(right.sectionId))
    .map(toContextPackSummarySentItem);
}

function compareSentItems(left: ContextSentItemRecord, right: ContextSentItemRecord): number {
  const lastSentCompare = left.lastSentAt.localeCompare(right.lastSentAt);
  if (lastSentCompare !== 0) return lastSentCompare;
  return left.sentItemId.localeCompare(right.sentItemId);
}

function toContextPackSummarySentItem(item: ContextSentItemRecord): ContextPackSummarySentItemInput {
  return {
    sentItemId: item.sentItemId,
    artifactId: item.artifactId,
    sectionId: item.sectionId,
    itemKind: item.itemKind,
    itemRef: item.itemRef,
    itemHash: item.itemHash,
    contentHash: item.contentHash,
    diffState: item.lastDiffState,
    wasPinned: item.wasPinned,
    firstSentAt: item.firstSentAt,
    lastSentAt: item.lastSentAt,
    sendCount: item.sendCount,
    tokenCount: item.tokenCount
  };
}
