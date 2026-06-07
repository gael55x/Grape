import type { ContextPackItemShape } from "./contracts.js";

export const grapeGetContextOutputModes = ["agent_pack", "full"] as const;

export type GrapeGetContextOutputMode = (typeof grapeGetContextOutputModes)[number];

export interface AgentContextArtifactRef {
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly artifactFiles: {
    readonly json: string;
    readonly markdown: string;
  };
  readonly fullArtifactTool: {
    readonly name: "grape_get_artifact";
    readonly arguments: {
      readonly artifactId: string;
      readonly outputMode: "full";
    };
  };
}

export type AgentContextGraphNode =
  | {
      readonly id: string;
      readonly kind: "section";
      readonly sectionId: string;
    }
  | {
      readonly id: string;
      readonly kind: "sent_item";
      readonly sentItemId: string;
    }
  | {
      readonly id: string;
      readonly kind: "restore_handle";
      readonly restoreId: string;
    };

export interface AgentContextGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: "renders_section" | "depends_on" | "invalidates" | "restores";
}

export interface AgentContextPackItemShape extends Omit<ContextPackItemShape, "content"> {
  readonly contentPreview: string;
  readonly contentOmitted: true;
}

export interface AgentContextGraphCut {
  readonly graphFormat: "grape.agent-context-graph.v1";
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly nodeCounts: {
    readonly packItems: number;
    readonly sections: number;
    readonly inputRefs: number;
    readonly sentItems: number;
    readonly restoreHandles: number;
  };
  readonly nodes: readonly AgentContextGraphNode[];
  readonly edges: readonly AgentContextGraphEdge[];
}

const compactScopeKeys = [
  "branch",
  "commit",
  "worktreeHash",
  "dirtyWorktree",
  "sourceScope",
  "environment",
  "featureFlagCount",
  "featureFlagScopeHash",
  "packageRoot",
  "serviceRoot",
  "path",
  "symbol",
  "route",
  "test"
] as const;

const maxContentPreviewChars = 280;

export function buildAgentContextArtifactRef(
  input: Omit<AgentContextArtifactRef, "fullArtifactTool">
): AgentContextArtifactRef {
  return {
    artifactId: input.artifactId,
    artifactHash: input.artifactHash,
    dependencyManifestHash: input.dependencyManifestHash,
    artifactFiles: input.artifactFiles,
    fullArtifactTool: {
      name: "grape_get_artifact",
      arguments: {
        artifactId: input.artifactId,
        outputMode: "full"
      }
    }
  };
}

export function compactAgentContextPackItems(
  items: readonly ContextPackItemShape[]
): readonly AgentContextPackItemShape[] {
  return items.map(({ content, ...item }) => ({
    ...item,
    contentPreview: compactContentPreview(content),
    contentOmitted: true,
    inputRefs: item.inputRefs.map((ref) => ({
      ...ref,
      scope: compactPackScope(ref.scope)
    }))
  }));
}

export function buildAgentContextGraphCut(input: {
  readonly artifactId: string;
  readonly artifactHash: string;
  readonly dependencyManifestHash: string;
  readonly contextPackItems: readonly AgentContextGraphPackItem[];
}): AgentContextGraphCut {
  const nodes = new Map<string, AgentContextGraphNode>();
  const edges = new Map<string, AgentContextGraphEdge>();
  const inputRefIds = new Set<string>();
  const sectionIds = new Set<string>();
  const sentItemIds = new Set<string>();
  const restoreIds = new Set<string>();

  for (const item of input.contextPackItems) {
    if (item.sectionId) {
      const sectionNodeId = sectionGraphNodeId(item.sectionId);
      sectionIds.add(item.sectionId);
      nodes.set(sectionNodeId, { id: sectionNodeId, kind: "section", sectionId: item.sectionId });
      addEdge(edges, { from: item.id, to: sectionNodeId, kind: "renders_section" });
    }

    for (const ref of item.inputRefs) {
      inputRefIds.add(ref.id);
      addEdge(edges, { from: item.id, to: ref.id, kind: "depends_on" });
    }

    if (item.invalidatesSentItemId) {
      const sentNodeId = sentItemGraphNodeId(item.invalidatesSentItemId);
      sentItemIds.add(item.invalidatesSentItemId);
      nodes.set(sentNodeId, { id: sentNodeId, kind: "sent_item", sentItemId: item.invalidatesSentItemId });
      addEdge(edges, { from: item.id, to: sentNodeId, kind: "invalidates" });
    }

    if (item.restoreId) {
      const restoreNodeId = restoreGraphNodeId(item.restoreId);
      restoreIds.add(item.restoreId);
      nodes.set(restoreNodeId, { id: restoreNodeId, kind: "restore_handle", restoreId: item.restoreId });
      addEdge(edges, { from: item.id, to: restoreNodeId, kind: "restores" });
    }
  }

  const graphNodes = [...nodes.values()].sort(compareGraphNodes);
  return {
    graphFormat: "grape.agent-context-graph.v1",
    artifactId: input.artifactId,
    artifactHash: input.artifactHash,
    dependencyManifestHash: input.dependencyManifestHash,
    nodeCounts: {
      packItems: input.contextPackItems.length,
      sections: sectionIds.size,
      inputRefs: inputRefIds.size,
      sentItems: sentItemIds.size,
      restoreHandles: restoreIds.size
    },
    nodes: graphNodes,
    edges: [...edges.values()].sort(compareGraphEdges)
  };
}

type AgentContextGraphPackItem = Pick<
  ContextPackItemShape,
  "id" | "sectionId" | "inputRefs" | "invalidatesSentItemId" | "restoreId"
>;

function compactContentPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxContentPreviewChars) return normalized;
  return `${normalized.slice(0, maxContentPreviewChars - 3)}...`;
}

function compactPackScope(scope: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = {};
  for (const key of compactScopeKeys) {
    const value = scope[key];
    if (isCompactScopeValue(value)) compacted[key] = value;
  }
  return compacted;
}

function isCompactScopeValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function sectionGraphNodeId(sectionId: string): string {
  return `section:${sectionId}`;
}

function sentItemGraphNodeId(sentItemId: string): string {
  return `sent:${sentItemId}`;
}

function restoreGraphNodeId(restoreId: string): string {
  return `restore:${restoreId}`;
}

function addEdge(edges: Map<string, AgentContextGraphEdge>, edge: AgentContextGraphEdge): void {
  edges.set(`${edge.from}\u0000${edge.kind}\u0000${edge.to}`, edge);
}

function compareGraphNodes(left: AgentContextGraphNode, right: AgentContextGraphNode): number {
  return left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}

function compareGraphEdges(left: AgentContextGraphEdge, right: AgentContextGraphEdge): number {
  return (
    left.from.localeCompare(right.from) ||
    left.kind.localeCompare(right.kind) ||
    left.to.localeCompare(right.to)
  );
}
