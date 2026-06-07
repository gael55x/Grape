import path from "node:path";

import { packageManifestKindForPath, type PackageManifestKind } from "../git/index.js";
import { tryNormalizeIndexRepoPath } from "./index-paths.js";

export type PackageRootProviderCapability = "package_roots";

export interface PackageRootFile {
  readonly path: string;
  readonly sha256: string;
  readonly sourceId: string;
}

export interface PackageRootEvidence {
  readonly packageRoot: string;
  readonly manifestRef: string;
  readonly manifestKind: PackageManifestKind;
  readonly sourceId: string;
  readonly sourceHash: string;
  readonly providerId: "generic_manifest";
  readonly providerCapabilities: readonly PackageRootProviderCapability[];
}

export interface PackageRootMetadata {
  readonly manifestPackageRoot?: string;
  readonly packageRoot?: string;
  readonly packageRootManifestRef?: string;
  readonly packageRootManifestKind?: PackageManifestKind;
  readonly packageRootManifestSourceId?: string;
  readonly packageRootManifestHash?: string;
  readonly packageRootProviderId?: "generic_manifest";
  readonly packageRootProviderCapabilities?: readonly PackageRootProviderCapability[];
}

const manifestProvider = {
  providerId: "generic_manifest" as const,
  providerCapabilities: ["package_roots"] as const
};

export function detectPackageRootEvidence(files: readonly PackageRootFile[]): readonly PackageRootEvidence[] {
  return files
    .map(packageRootEvidenceForFile)
    .filter((evidence): evidence is PackageRootEvidence => evidence !== undefined)
    .sort((left, right) =>
      `${left.packageRoot}:${left.manifestRef}`.localeCompare(`${right.packageRoot}:${right.manifestRef}`)
    );
}

export function packageRootMetadataForFile(
  file: PackageRootFile,
  packageRoots: readonly PackageRootEvidence[]
): PackageRootMetadata {
  const manifestRoot = packageRoots.find((root) => root.manifestRef === file.path);
  const ownerRoot = owningPackageRoot(file.path, packageRoots);
  return {
    ...(manifestRoot
      ? {
          manifestPackageRoot: manifestRoot.packageRoot,
          packageRootManifestKind: manifestRoot.manifestKind,
          packageRootManifestSourceId: manifestRoot.sourceId,
          packageRootManifestHash: manifestRoot.sourceHash,
          packageRootProviderId: manifestProvider.providerId,
          packageRootProviderCapabilities: [...manifestProvider.providerCapabilities]
        }
      : {}),
    ...(ownerRoot
      ? {
          packageRoot: ownerRoot.packageRoot,
          packageRootManifestRef: ownerRoot.manifestRef,
          packageRootManifestKind: ownerRoot.manifestKind,
          packageRootManifestSourceId: ownerRoot.sourceId,
          packageRootManifestHash: ownerRoot.sourceHash,
          packageRootProviderId: manifestProvider.providerId,
          packageRootProviderCapabilities: [...manifestProvider.providerCapabilities]
        }
      : {})
  };
}

export function packageRootMetadataFields(metadata: PackageRootMetadata): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
}

function packageRootEvidenceForFile(file: PackageRootFile): PackageRootEvidence | undefined {
  const manifestRef = tryNormalizeIndexRepoPath(file.path);
  if (!manifestRef) return undefined;
  const manifestKind = packageManifestKindForPath(manifestRef);
  if (!manifestKind) return undefined;
  return {
    packageRoot: packageRootForManifestRef(manifestRef),
    manifestRef,
    manifestKind,
    sourceId: file.sourceId,
    sourceHash: file.sha256,
    ...manifestProvider
  };
}

function packageRootForManifestRef(manifestRef: string): string {
  const dirname = path.posix.dirname(manifestRef);
  return dirname === "." ? "." : dirname;
}

function owningPackageRoot(
  repoPath: string,
  packageRoots: readonly PackageRootEvidence[]
): PackageRootEvidence | undefined {
  const normalized = tryNormalizeIndexRepoPath(repoPath);
  if (!normalized) return undefined;
  return packageRoots
    .filter((root) => root.packageRoot !== ".")
    .filter((root) => normalized === root.packageRoot || normalized.startsWith(`${root.packageRoot}/`))
    .sort((left, right) => right.packageRoot.length - left.packageRoot.length)[0];
}
