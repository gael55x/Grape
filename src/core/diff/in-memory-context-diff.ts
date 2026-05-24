import type {
  InMemoryContextArtifactShape,
  InMemoryContextPackItemShape,
  InMemoryContextSectionShape
} from "../../shared/index.js";

export interface InMemorySentItemShape {
  itemId: string;
  sessionId: string;
  artifactId: string;
  sectionId: string;
  contentHash: string;
  pinned: boolean;
  restoreToken?: string;
}

export interface InMemoryOmittedItemShape {
  sessionId: string;
  artifactId: string;
  sectionId: string;
  restoreToken: string;
  reason: "unchanged_restorable";
}

export interface InMemoryContextDiffInput {
  sessionId: string;
  artifact: InMemoryContextArtifactShape;
  previouslySent: readonly InMemorySentItemShape[];
}

export interface InMemoryContextDiffResult {
  sessionId: string;
  contextPackItems: InMemoryContextPackItemShape[];
  omittedItems: InMemoryOmittedItemShape[];
  unsafeOmissions: number;
}

export function createInMemoryContextDiff(input: InMemoryContextDiffInput): InMemoryContextDiffResult {
  const previousBySection = new Map<string, InMemorySentItemShape>();

  for (const previous of input.previouslySent) {
    if (previous.sessionId === input.sessionId) {
      previousBySection.set(previous.sectionId, previous);
    }
  }

  const contextPackItems: InMemoryContextPackItemShape[] = [];
  const omittedItems: InMemoryOmittedItemShape[] = [];
  let unsafeOmissions = 0;

  for (const section of input.artifact.sections) {
    const previous = previousBySection.get(section.id);

    if (section.pinned) {
      contextPackItems.push(createPackItem(input, section, "PINNED", previous));
      continue;
    }

    if (!previous) {
      contextPackItems.push(createPackItem(input, section, "NEW"));
      continue;
    }

    if (previous.contentHash !== section.contentHash) {
      contextPackItems.push(createPackItem(input, section, "CHANGED", previous));
      continue;
    }

    const restoreToken = createRestoreToken(input.sessionId, input.artifact.artifactId, section.id);

    if (restoreToken.length === 0) {
      unsafeOmissions += 1;
      contextPackItems.push(createPackItem(input, section, "CHANGED", previous));
      continue;
    }

    omittedItems.push({
      sessionId: input.sessionId,
      artifactId: input.artifact.artifactId,
      sectionId: section.id,
      restoreToken,
      reason: "unchanged_restorable"
    });

    contextPackItems.push(
      createPackItem(input, section, "OMIT_UNCHANGED", previous, {
        body: "",
        restoreToken,
        safeOmissionReason: "unchanged_restorable"
      })
    );

    contextPackItems.push(
      createPackItem(input, section, "RESTORE_AVAILABLE", previous, {
        body: "",
        restoreToken,
        safeOmissionReason: "unchanged_restorable"
      })
    );
  }

  return {
    sessionId: input.sessionId,
    contextPackItems,
    omittedItems,
    unsafeOmissions
  };
}

function createPackItem(
  input: InMemoryContextDiffInput,
  section: InMemoryContextSectionShape,
  state: InMemoryContextPackItemShape["state"],
  previous?: InMemorySentItemShape,
  omission?: {
    body: string;
    restoreToken: string;
    safeOmissionReason: "unchanged_restorable";
  }
): InMemoryContextPackItemShape {
  return {
    itemId: `${input.sessionId}:${input.artifact.artifactId}:${section.id}:${state}`,
    artifactId: input.artifact.artifactId,
    sessionId: input.sessionId,
    sectionId: section.id,
    state,
    title: section.title,
    body: omission?.body ?? section.body,
    contentHash: section.contentHash,
    previousItemId: previous?.itemId,
    restoreToken: omission?.restoreToken,
    safeOmissionReason: omission?.safeOmissionReason,
    pinned: section.pinned,
    warnings: []
  };
}

function createRestoreToken(sessionId: string, artifactId: string, sectionId: string): string {
  return `restore:${sessionId}:${artifactId}:${sectionId}`;
}
