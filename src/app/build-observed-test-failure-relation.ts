import { createHash } from "node:crypto";

import type { RepositoryArtifactSourceExcerptInput, RepositoryArtifactSourceInput } from "../core/compiler/index.js";
import type { ObservedRunProofMaterial } from "../core/proofs/observed-run-proof-types.js";
import { extractTestFailureLocations } from "../core/proofs/test-failure-location-extract.js";
import type {
  ObservedTestFailureCandidateLink,
  ObservedTestFailureFilenameConventionEvidence,
  ObservedTestFailureImportEvidence,
  ObservedTestFailureManifestPackageRootEvidence,
  ObservedTestFailurePackageBoundaryEvidence,
  ObservedTestFailureRelationMaterial,
  ObservedTestFailureSpanRef
} from "../core/proofs/observed-test-failure-relation-types.js";
import { observedTestFailureRelationHash } from "../core/proofs/observed-test-failure-relation-hash.js";
import { packageRootForSourceRefWithMetadata } from "../core/scope/package-root.js";

export interface BuildObservedTestFailureRelationSymbolNode {
  readonly symbolId: string;
  readonly path: string;
  readonly metadataJson?: string;
}

export interface BuildObservedTestFailureRelationSymbolEdge {
  readonly edgeId: string;
  readonly edgeType: string;
  readonly fromSymbolId: string;
  readonly toSymbolId?: string;
  readonly toRef?: string;
}

export interface BuildObservedTestFailureRelationInput {
  readonly material: ObservedRunProofMaterial;
  readonly observedRunClaimId: string;
  readonly observedRunProofId: string;
  readonly failureOutputText: string;
  readonly sources: readonly RepositoryArtifactSourceInput[];
  readonly symbolNodes: readonly BuildObservedTestFailureRelationSymbolNode[];
  readonly symbolEdges: readonly BuildObservedTestFailureRelationSymbolEdge[];
  readonly manifestPackageRoots: readonly ObservedTestFailureManifestPackageRootEvidence[];
  readonly normalizePath: (candidate: string) => string | undefined;
  readonly readSpanExcerpt: (
    source: RepositoryArtifactSourceInput,
    anchorLine: number
  ) => RepositoryArtifactSourceExcerptInput | undefined;
}

export interface BuildObservedTestFailureRelationResult {
  readonly accepted: boolean;
  readonly rejectionReason?: string;
  readonly relation?: ObservedTestFailureRelationMaterial;
  readonly spanExcerpts?: readonly RepositoryArtifactSourceExcerptInput[];
}

const maxCandidateLinks = 4;

export function buildObservedTestFailureRelation(
  input: BuildObservedTestFailureRelationInput
): BuildObservedTestFailureRelationResult {
  if (input.material.sourceType !== "test_run") {
    return { accepted: false, rejectionReason: "unsupported_source_type" };
  }
  if (input.material.metadata.passed !== false) {
    return { accepted: false, rejectionReason: "observed_run_not_failed" };
  }

  const sourceByRef = new Map(
    input.sources
      .filter((source) => source.trustClass === "trusted" && source.privacyStatus === "allowed")
      .map((source) => [source.sourceRef, source])
  );
  const parsedLocations = extractTestFailureLocations(input.failureOutputText, input.normalizePath);
  const testRefs = uniqueRefs([
    ...(input.material.metadata.testFiles ?? []),
    ...parsedLocations.filter((location) => isTestSourceRef(location.sourceRef)).map((location) => location.sourceRef)
  ]);
  if (testRefs.length === 0) {
    return { accepted: false, rejectionReason: "no_candidate_links" };
  }

  const spanExcerpts: RepositoryArtifactSourceExcerptInput[] = [];
  const candidateLinks: ObservedTestFailureCandidateLink[] = [];
  const linkedSourceRefs = new Set<string>();
  const sourceMetadataByRef = sourceMetadataByRefFromSymbolNodes(input.symbolNodes);

  for (const testRef of testRefs) {
    if (candidateLinks.length >= maxCandidateLinks) break;
    const testSource = sourceByRef.get(testRef);
    const testFailureLine =
      parsedLocations.find((location) => location.sourceRef === testRef)?.line ??
      parsedLocations.find((location) => isTestSourceRef(location.sourceRef))?.line;
    const testSpan = testSource
      ? toSpanRef(testSource, input.readSpanExcerpt(testSource, testFailureLine ?? 1), spanExcerpts)
      : undefined;
    if (testSpan) linkedSourceRefs.add(testSpan.sourceRef);

    const importEvidence = findImportEvidence(testRef, input.symbolNodes, input.symbolEdges);
    const filenameEvidence = candidateSourceRefFromTestRef(testRef, sourceByRef);
    const parsedSourceLocations = parsedLocations.filter(
      (location) => location.sourceRef !== testRef && !isTestSourceRef(location.sourceRef)
    );
    const candidateSourceRefs = uniqueRefs([
      ...parsedSourceLocations.map((location) => location.sourceRef),
      importEvidence?.sourceRef,
      filenameEvidence?.candidateSourceRef
    ].filter((ref): ref is string => Boolean(ref)));

    const warnings: string[] = [];
    if (!testSpan) warnings.push("missing_exact_test_span");
    if (candidateSourceRefs.length === 0) warnings.push("missing_candidate_source_span");

    let candidateSourceSpan: ObservedTestFailureSpanRef | undefined;
    let packageBoundaryEvidence: ObservedTestFailurePackageBoundaryEvidence | undefined;
    let manifestPackageRootEvidence: ObservedTestFailureManifestPackageRootEvidence | undefined;

    for (const candidateRef of candidateSourceRefs) {
      const candidateSource = sourceByRef.get(candidateRef);
      if (!candidateSource) continue;
      const anchorLine =
        parsedSourceLocations.find((location) => location.sourceRef === candidateRef)?.line ?? 1;
      candidateSourceSpan = toSpanRef(
        candidateSource,
        input.readSpanExcerpt(candidateSource, anchorLine),
        spanExcerpts
      );
      if (!candidateSourceSpan) continue;
      linkedSourceRefs.add(candidateSourceSpan.sourceRef);

      const packageRoot = packageRootForSourceRefWithMetadata(candidateRef, sourceMetadataByRef.get(candidateRef));
      if (packageRoot) {
        packageBoundaryEvidence = { packageRoot, sourceRef: candidateRef };
        manifestPackageRootEvidence = input.manifestPackageRoots.find(
          (entry) => entry.packageRootRef === packageRoot
        );
      }
      break;
    }

    if (!importEvidence) warnings.push("missing_import_evidence");
    if (!filenameEvidence) warnings.push("missing_filename_convention_evidence");
    if (!packageBoundaryEvidence) warnings.push("missing_package_boundary_evidence");
    if (!manifestPackageRootEvidence) warnings.push("missing_manifest_package_root_evidence");

    candidateLinks.push({
      linkId: stableHash(["failure_link", input.material.metadata.observedRunId, testRef]).slice(0, 24),
      testSpan,
      candidateSourceSpan,
      importEvidence,
      packageBoundaryEvidence,
      filenameConventionEvidence: filenameEvidence,
      manifestPackageRootEvidence,
      missingEvidenceWarnings: warnings
    });
  }

  if (candidateLinks.length === 0) {
    return { accepted: false, rejectionReason: "no_candidate_links" };
  }

  const relationBody = {
    observedRunId: input.material.metadata.observedRunId,
    observedRunClaimId: input.observedRunClaimId,
    observedRunProofId: input.observedRunProofId,
    observedCommand: {
      commandHash: input.material.metadata.commandHash,
      cwd: input.material.metadata.cwd
    },
    failureOutput: {
      stdoutHash: input.material.metadata.stdoutHash,
      stderrHash: input.material.metadata.stderrHash,
      failureOutputHash: failureOutputHash(input.material.metadata.stdoutHash, input.material.metadata.stderrHash)
    },
    candidateLinks
  };
  const relationHash = observedTestFailureRelationHash(relationBody);

  return {
    accepted: true,
    relation: {
      sourceId: input.material.sourceId,
      sourceRef: input.material.sourceRef,
      sourceHash: input.material.sourceHash,
      observedRunId: input.material.metadata.observedRunId,
      observedRunClaimId: input.observedRunClaimId,
      observedRunProofId: input.observedRunProofId,
      observedRunMaterial: input.material,
      observedCommand: relationBody.observedCommand,
      failureOutput: relationBody.failureOutput,
      candidateLinks,
      linkedSourceRefs: [...linkedSourceRefs].sort(),
      relationHash
    },
    spanExcerpts
  };
}

function toSpanRef(
  source: RepositoryArtifactSourceInput,
  excerpt: RepositoryArtifactSourceExcerptInput | undefined,
  spanExcerpts: RepositoryArtifactSourceExcerptInput[]
): ObservedTestFailureSpanRef | undefined {
  if (!excerpt) return undefined;
  spanExcerpts.push(excerpt);
  return {
    proofId: excerpt.proofId,
    sourceRef: excerpt.sourceRef,
    sourceHash: excerpt.sourceHash,
    startLine: excerpt.startLine,
    endLine: excerpt.endLine,
    excerptHash: excerpt.excerptHash
  };
}

function findImportEvidence(
  testRef: string,
  symbolNodes: readonly BuildObservedTestFailureRelationSymbolNode[],
  symbolEdges: readonly BuildObservedTestFailureRelationSymbolEdge[]
): ObservedTestFailureImportEvidence | undefined {
  const pathBySymbolId = new Map(symbolNodes.map((node) => [node.symbolId, node.path]));
  for (const edge of symbolEdges) {
    if (edge.edgeType !== "imports" && edge.edgeType !== "calls") continue;
    const edgeTestRef = pathBySymbolId.get(edge.fromSymbolId);
    const targetRef = edge.toSymbolId ? pathBySymbolId.get(edge.toSymbolId) : edge.toRef;
    if (edgeTestRef !== testRef || !targetRef || targetRef === testRef || isTestSourceRef(targetRef)) {
      continue;
    }
    return {
      relationshipRef: edge.edgeId,
      testRef,
      sourceRef: targetRef,
      relationship: edge.edgeType === "calls" ? "calls" : "imports"
    };
  }
  return undefined;
}

function sourceMetadataByRefFromSymbolNodes(
  symbolNodes: readonly BuildObservedTestFailureRelationSymbolNode[]
): ReadonlyMap<string, string> {
  const metadataByRef = new Map<string, string>();
  for (const node of symbolNodes) {
    if (metadataByRef.has(node.path) || !node.metadataJson) continue;
    metadataByRef.set(node.path, node.metadataJson);
  }
  return metadataByRef;
}

function candidateSourceRefFromTestRef(
  testRef: string,
  sourceByRef: ReadonlyMap<string, RepositoryArtifactSourceInput>
): ObservedTestFailureFilenameConventionEvidence | undefined {
  const match = testRef.match(/^(.*\/)?([^/]+)\.(?:test|spec)\.([cm]?[jt]sx?)$/);
  if (!match) return undefined;
  const [, dirPart = "", baseName, extension] = match;
  const normalizedDir = dirPart.replace(/^(.*\/)?tests?\/?$/, "");
  const candidates = uniqueRefs([
    `${normalizedDir}${baseName}.${extension}`,
    `src/${baseName}.${extension}`,
    `${dirPart}${baseName}.${extension}`.replace(/\/tests?\//, "/")
  ]);
  const candidateSourceRef = candidates.find((candidate) => sourceByRef.has(candidate));
  if (!candidateSourceRef) return undefined;
  return { testRef, candidateSourceRef };
}

function failureOutputHash(stdoutHash: string, stderrHash: string): string {
  return stableHash(["failure_output", stdoutHash, stderrHash]);
}

function uniqueRefs(refs: readonly string[]): string[] {
  return [...new Set(refs.filter(Boolean))].sort();
}

function isTestSourceRef(sourceRef: string): boolean {
  return /(?:^|\/)[^/]+\.(?:test|spec)\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/.test(sourceRef);
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
