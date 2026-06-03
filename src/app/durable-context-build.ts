import type { DatabaseSync } from "node:sqlite";

import { applyInMemoryContextPackBudget } from "../core/compiler/index.js";
import type { ContextPackBudgetResult } from "../core/compiler/index.js";
import { calculateInMemoryTokenSavings, createInMemoryContextDiff } from "../core/diff/index.js";
import type { InMemoryTokenSavingsMetric } from "../core/diff/index.js";
import type {
  ContextSessionCompileStateUpdate,
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
import { partitionPriorContextByStaleness } from "./durable-context-staleness.js";

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
  readonly sessionUpdate?: ContextSessionCompileStateUpdate;
  readonly sessionInvalidation?: DurableSessionInvalidation;
  readonly sessionReset?: DurableSessionReset;
  readonly tokenBudget?: number;
  readonly prepareOutput?: (preview: DurableContextBuildPreview) => void;
}

export interface DurableSessionInvalidation {
  readonly reason: "branch_changed";
  readonly previousBranch: string;
  readonly nextBranch: string;
  readonly previousHeadCommit: string;
  readonly nextHeadCommit: string;
}

export interface DurableSessionReset {
  readonly resetId: string;
  readonly reason: "agent_session_reset";
}

export interface DurableContextBuildResult {
  readonly sessionId: string;
  readonly artifactId: string;
  readonly contextPackItems: readonly InMemoryContextPackItemShape[];
  readonly omittedItems: readonly OmittedContextItemRecord[];
  readonly sentItems: readonly ContextSentItemRecord[];
  readonly tokenMetric: InMemoryTokenSavingsMetric;
  readonly budget: ContextPackBudgetResult;
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

    if (input.sessionUpdate && !input.repositories.contextSessions.updateCompileState(input.sessionUpdate)) {
      throw new Error(`context session compile state could not be updated: ${input.sessionId}`);
    }

    if (input.sessionInvalidation) {
      input.repositories.sessionEvents.insert({
        eventId: `${input.artifact.artifactId}:session_invalidated`,
        sessionId: input.sessionId,
        eventType: "session_invalidated",
        reason: input.sessionInvalidation.reason,
        metadataJson: JSON.stringify(input.sessionInvalidation),
        createdAt: input.now
      });
    }

    if (input.sessionReset) {
      input.repositories.sessionEvents.insert({
        eventId: `${input.artifact.artifactId}:session_reset`,
        sessionId: input.sessionId,
        eventType: "session_invalidated",
        reason: "session_reset",
        metadataJson: JSON.stringify(input.sessionReset),
        createdAt: input.now
      });
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
    const sentPackItems = input.repositories.contextPackItems.listSentPayloadsBySession(input.sessionId);
    const alreadyInvalidatedSentItemIds = new Set(
      input.repositories.contextPackItems.listInvalidatedSentItemIdsBySession(input.sessionId)
    );
    const activePriorItems = priorSentItems.filter(
      (item) => !alreadyInvalidatedSentItemIds.has(item.sentItemId)
    );
    const { currentPriorItems, stalePriorItems } = partitionPriorContextByStaleness({
      activePriorItems,
      packItems: sentPackItems,
      artifact: input.artifact,
      listDependenciesByArtifact: (artifactId) =>
        input.repositories.contextDependencies.listByArtifact(artifactId),
      forceStale: Boolean(input.sessionReset)
    });

    persistArtifact(input);

    const invalidationItems = stalePriorItems.map((item) =>
      createInvalidationPackItem(
        input,
        item.sentItemId,
        item.sectionId,
        item.contentHash,
        input.sessionReset ? "session_reset" : "dependency_manifest_changed"
      )
    );
    const diff = createInMemoryContextDiff({
      sessionId: input.sessionId,
      artifact: input.artifact,
      previouslySent: currentPriorItems.map(toInMemorySentItem)
    });

    const budgetedPack = applyInMemoryContextPackBudget({
      tokenBudget: input.tokenBudget,
      artifact: input.artifact,
      contextPackItems: [...invalidationItems, ...diff.contextPackItems]
    });
    const contextPackItems = budgetedPack.contextPackItems;
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
      budget: budgetedPack.budget,
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
