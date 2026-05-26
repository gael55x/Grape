import type { DatabaseSync } from "node:sqlite";

import { calculateInMemoryTokenSavings, createInMemoryContextDiff } from "../core/diff/index.js";
import type { InMemoryTokenSavingsMetric } from "../core/diff/index.js";
import type {
  ContextSentItemRecord,
  OmittedContextItemRecord,
  StorageRepositories
} from "../core/storage/index.js";
import { runStorageTransaction } from "../core/storage/index.js";
import type {
  InMemoryContextArtifactShape,
  InMemoryContextPackItemShape
} from "../shared/index.js";
import {
  createInvalidationPackItem,
  isSentDiffState,
  persistArtifact,
  toContextPackItem,
  toContextSentItem,
  toInMemorySentItem,
  toOmittedContextItem
} from "./durable-context-records.js";

export interface DurableContextBuildInput {
  readonly database: DatabaseSync;
  readonly repositories: StorageRepositories;
  readonly sessionId: string;
  readonly lockToken: string;
  readonly snapshotId: string;
  readonly artifact: InMemoryContextArtifactShape;
  readonly fixture: string;
  readonly turn: number;
  readonly now: string;
  readonly prepareOutput?: (preview: DurableContextBuildPreview) => void;
}

export interface DurableContextBuildResult {
  readonly sessionId: string;
  readonly artifactId: string;
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
  readonly omittedItems: readonly OmittedContextItemRecord[];
  readonly sentItems: readonly ContextSentItemRecord[];
  readonly tokenMetric: InMemoryTokenSavingsMetric;
  readonly unsafeOmissions: number;
}

export interface DurableContextBuildPreview extends DurableContextBuildResult {}

export function buildDurableContext(input: DurableContextBuildInput): DurableContextBuildResult {
  assertArtifactMatchesSession(input);

  return runStorageTransaction(input.database, () => {
    const lockHeld = input.repositories.contextSessions.renewLock({
      sessionId: input.sessionId,
      lockToken: input.lockToken,
      now: input.now
    }) || input.repositories.contextSessions.acquireLock({
      sessionId: input.sessionId,
      lockToken: input.lockToken,
      now: input.now
    });

    if (!lockHeld) {
      throw new Error(`context build requires an active session lock: ${input.sessionId}`);
    }

    input.repositories.sessionEvents.insert({
      eventId: `${input.artifact.artifactId}:build_started`,
      sessionId: input.sessionId,
      eventType: "context_build_started",
      reason: "durable_context_build",
      metadataJson: JSON.stringify({ artifactId: input.artifact.artifactId }),
      createdAt: input.now
    });

    const priorSentItems = input.repositories.contextSentItems.listBySession(input.sessionId);
    const stalePriorItems = priorSentItems.filter(
      (item) => item.dependencyManifestHash !== input.artifact.dependencyManifest.manifestHash
    );
    const currentPriorItems = priorSentItems.filter(
      (item) => item.dependencyManifestHash === input.artifact.dependencyManifest.manifestHash
    );

    persistArtifact(input);

    const invalidationItems = stalePriorItems.map((item) =>
      createInvalidationPackItem(input, item.sentItemId, item.sectionId, item.contentHash)
    );
    const diff = createInMemoryContextDiff({
      sessionId: input.sessionId,
      artifact: input.artifact,
      previouslySent: currentPriorItems.map(toInMemorySentItem)
    });

    const contextPackItems = [...invalidationItems, ...diff.contextPackItems];
    const sentItems = contextPackItems
      .filter(isSentDiffState)
      .map((item) => toContextSentItem(input, item, priorSentItems));
    const omittedItems = diff.omittedItems.map((item) =>
      toOmittedContextItem(input, item.sectionId, item.restoreToken)
    );

    for (const item of contextPackItems) {
      input.repositories.contextPackItems.insert(toContextPackItem(input, item));
    }
    for (const item of sentItems) {
      input.repositories.contextSentItems.insert(item);
    }
    for (const item of omittedItems) {
      input.repositories.omittedContextItems.insert(item);
    }

    input.repositories.sessionEvents.insert({
      eventId: `${input.artifact.artifactId}:context_pack_persisted`,
      sessionId: input.sessionId,
      eventType: "context_pack_persisted",
      reason: "durable_context_build",
      metadataJson: JSON.stringify({
        artifactId: input.artifact.artifactId,
        packItemCount: contextPackItems.length,
        sentItemCount: sentItems.length,
        omittedItemCount: omittedItems.length
      }),
      createdAt: input.now
    });

    const tokenMetric = calculateInMemoryTokenSavings({
      fixture: input.fixture,
      taskId: input.artifact.input.taskId,
      turn: input.turn,
      selectedSections: input.artifact.sections,
      contextPackItems,
      unsafeOmissions: diff.unsafeOmissions
    });
    const preview = {
      sessionId: input.sessionId,
      artifactId: input.artifact.artifactId,
      contextPackItems,
      omittedItems,
      sentItems,
      tokenMetric,
      unsafeOmissions: diff.unsafeOmissions
    };

    input.prepareOutput?.(preview);

    return preview;
  });
}

function assertArtifactMatchesSession(input: DurableContextBuildInput): void {
  if (input.artifact.input.sessionId !== input.sessionId) {
    throw new Error("context build artifact session does not match build session");
  }
}
