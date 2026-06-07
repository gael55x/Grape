import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";

import { packageRootForSourceRef } from "../scope/package-root.js";
import { evaluateDurableClaimPolicy } from "./claim-policy.js";

export const packageManifestDependencyClaimType = "package_manifest_dependency_exists";
export const packageManifestDependencyProofType = "package_manifest_dependency_entry";

export type PackageManifestDependencySection =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

export interface PackageManifestDependencyClaimSource {
  readonly sourceId: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly trustClass: string;
  readonly privacyStatus: string;
  readonly redactionStatus: string;
  readonly metadataJson: string;
}

export interface PackageManifestDependencyEntry {
  readonly sourceId: string;
  readonly sourceRef: string;
  readonly sourceHash: string;
  readonly sourceScope: string;
  readonly manifestKind: "npm_package";
  readonly manifestRef: string;
  readonly packageRootRef: string;
  readonly packageRoot?: string;
  readonly dependencyName: string;
  readonly dependencySection: PackageManifestDependencySection;
  readonly dependencySpecifierHash: string;
  readonly entryHash: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly providerId: "generic_manifest";
  readonly providerCapabilities: readonly ["package_roots"];
}

export interface PackageManifestDependencyClaimProof {
  readonly sourceId: string;
  readonly proofType: string;
  readonly sourceHash: string;
  readonly excerptHash: string;
  readonly supportStatus: string;
}

export interface PackageManifestDependencyClaimScope {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly packageRoot?: string;
  readonly worktreeHash: string;
  readonly sourceRef: string;
  readonly sourceId: string;
  readonly sourceScope: string;
  readonly sourceHash: string;
  readonly proofId: string;
  readonly excerptHash: string;
  readonly manifestRef: string;
  readonly manifestKind: "npm_package";
  readonly packageRootRef: string;
  readonly dependencyName: string;
  readonly dependencySection: PackageManifestDependencySection;
  readonly dependencySpecifierHash: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly providerId: "generic_manifest";
  readonly providerCapabilities: readonly ["package_roots"];
}

export interface PackageManifestDependencyClaimDraft {
  readonly candidateId: string;
  readonly claimId: string;
  readonly proofId: string;
  readonly subject: string;
  readonly claimType: typeof packageManifestDependencyClaimType;
  readonly claimText: string;
  readonly scope: PackageManifestDependencyClaimScope;
}

export type PackageManifestDependencyClaimGateResult =
  | { readonly accepted: true }
  | { readonly accepted: false; readonly reason: string };

const dependencySections: readonly PackageManifestDependencySection[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
];

const providerId = "generic_manifest" as const;
const providerCapabilities = ["package_roots"] as const;

export function extractPackageManifestDependencyEntries(input: {
  readonly source: PackageManifestDependencyClaimSource;
  readonly text: string;
}): readonly PackageManifestDependencyEntry[] {
  if (!isNpmPackageManifestSource(input.source)) return [];

  const sourceFile = ts.parseJsonText(input.source.sourceRef, input.text);
  if (parseDiagnostics(sourceFile).length > 0) return [];
  const root = sourceFile.statements[0]?.expression;
  if (!root || !ts.isObjectLiteralExpression(root)) return [];

  const packageRootRef = packageRootRefForManifest(input.source.sourceRef);
  const packageRoot = packageRootForSourceRef(input.source.sourceRef);
  const entries: PackageManifestDependencyEntry[] = [];

  for (const property of root.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const section = propertyName(property.name);
    if (!isDependencySection(section)) continue;
    if (!ts.isObjectLiteralExpression(property.initializer)) continue;

    for (const dependency of property.initializer.properties) {
      if (!ts.isPropertyAssignment(dependency)) continue;
      const dependencyName = propertyName(dependency.name);
      if (!isSafeDependencyName(dependencyName)) continue;
      if (!ts.isStringLiteralLike(dependency.initializer)) continue;

      const entryStart = dependency.getStart(sourceFile);
      const entryEnd = dependency.getEnd();
      const entryText = input.text.slice(entryStart, entryEnd);
      const startLine = sourceFile.getLineAndCharacterOfPosition(entryStart).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(entryEnd).line + 1;

      entries.push({
        sourceId: input.source.sourceId,
        sourceRef: input.source.sourceRef,
        sourceHash: input.source.sourceHash,
        sourceScope: input.source.sourceScope,
        manifestKind: "npm_package",
        manifestRef: input.source.sourceRef,
        packageRootRef,
        ...(packageRoot ? { packageRoot } : {}),
        dependencyName,
        dependencySection: section,
        dependencySpecifierHash: stableHash(["specifier", dependency.initializer.text]),
        entryHash: sha256(entryText),
        startLine,
        endLine,
        providerId,
        providerCapabilities
      });
    }
  }

  return entries.sort((left, right) =>
    `${left.sourceRef}:${left.dependencySection}:${left.dependencyName}`.localeCompare(
      `${right.sourceRef}:${right.dependencySection}:${right.dependencyName}`
    )
  );
}

export function createPackageManifestDependencyClaimDraft(input: {
  readonly branch: string;
  readonly commit: string;
  readonly environment?: string;
  readonly worktreeHash: string;
  readonly entry: PackageManifestDependencyEntry;
}): PackageManifestDependencyClaimDraft {
  const proofId = packageManifestDependencyProofId(input.entry);
  const scope: PackageManifestDependencyClaimScope = {
    branch: input.branch,
    commit: input.commit,
    ...(input.environment ? { environment: input.environment } : {}),
    ...(input.entry.packageRoot ? { packageRoot: input.entry.packageRoot } : {}),
    worktreeHash: input.worktreeHash,
    sourceRef: input.entry.sourceRef,
    sourceId: input.entry.sourceId,
    sourceScope: input.entry.sourceScope,
    sourceHash: input.entry.sourceHash,
    proofId,
    excerptHash: input.entry.entryHash,
    manifestRef: input.entry.manifestRef,
    manifestKind: input.entry.manifestKind,
    packageRootRef: input.entry.packageRootRef,
    dependencyName: input.entry.dependencyName,
    dependencySection: input.entry.dependencySection,
    dependencySpecifierHash: input.entry.dependencySpecifierHash,
    startLine: input.entry.startLine,
    endLine: input.entry.endLine,
    providerId: input.entry.providerId,
    providerCapabilities: input.entry.providerCapabilities
  };

  return {
    candidateId: `candidate:${stableHash([
      packageManifestDependencyClaimType,
      input.entry.sourceId,
      input.entry.sourceHash,
      input.entry.dependencySection,
      input.entry.dependencyName,
      input.entry.entryHash
    ]).slice(0, 24)}`,
    claimId: packageManifestDependencyClaimId(input.entry),
    proofId,
    subject: `${input.entry.sourceRef}#${input.entry.dependencySection}:${input.entry.dependencyName}`,
    claimType: packageManifestDependencyClaimType,
    claimText: `Manifest declares dependency ${input.entry.dependencyName}.`,
    scope
  };
}

export function evaluatePackageManifestDependencyClaimGate(input: {
  readonly source: PackageManifestDependencyClaimSource | undefined;
  readonly entry: PackageManifestDependencyEntry;
  readonly proof: PackageManifestDependencyClaimProof | undefined;
}): PackageManifestDependencyClaimGateResult {
  if (!input.source) return { accepted: false, reason: "source_missing" };
  if (!input.proof) return { accepted: false, reason: "proof_missing" };
  if (!isNpmPackageManifestSource(input.source)) return { accepted: false, reason: "source_not_npm_manifest" };
  if (input.entry.manifestKind !== "npm_package") return { accepted: false, reason: "manifest_kind_not_supported" };
  if (input.entry.providerId !== providerId) return { accepted: false, reason: "provider_not_allowed" };
  if (!input.entry.providerCapabilities.includes("package_roots")) {
    return { accepted: false, reason: "provider_capability_missing" };
  }

  const policy = evaluateDurableClaimPolicy({
    claimType: packageManifestDependencyClaimType,
    claimMeaning: "manifest_dependency_declared",
    proofType: input.proof.proofType,
    sourceType: input.source.sourceType,
    supportStatus: input.proof.supportStatus,
    sourceTrustClass: input.source.trustClass,
    sourcePrivacyStatus: input.source.privacyStatus,
    sourceRedactionStatus: input.source.redactionStatus,
    observer: "local_source_reader",
    proofSignalKind: "exact_source"
  });
  if (!policy.accepted) return { accepted: false, reason: policy.reason };
  if (input.proof.sourceId !== input.entry.sourceId) return { accepted: false, reason: "proof_source_mismatch" };
  if (input.proof.sourceHash !== input.entry.sourceHash) {
    return { accepted: false, reason: "proof_source_hash_mismatch" };
  }
  if (input.proof.excerptHash !== input.entry.entryHash) {
    return { accepted: false, reason: "proof_entry_hash_mismatch" };
  }
  return { accepted: true };
}

export function packageManifestDependencyClaimId(entry: PackageManifestDependencyEntry): string {
  return `claim:${stableHash([
    packageManifestDependencyClaimType,
    entry.sourceId,
    entry.sourceHash,
    entry.dependencySection,
    entry.dependencyName,
    entry.entryHash
  ]).slice(0, 24)}`;
}

export function packageManifestDependencyProofId(entry: PackageManifestDependencyEntry): string {
  return `proof:${stableHash([
    packageManifestDependencyProofType,
    entry.sourceId,
    entry.sourceHash,
    entry.dependencySection,
    entry.dependencyName,
    entry.entryHash
  ]).slice(0, 24)}`;
}

function isNpmPackageManifestSource(source: PackageManifestDependencyClaimSource): boolean {
  return (
    source.sourceType === "config_file" &&
    path.posix.basename(source.sourceRef) === "package.json" &&
    sourceKind(source) === "package"
  );
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isStringLiteralLike(name) || ts.isIdentifier(name)) return name.text;
  return "";
}

function isDependencySection(value: string): value is PackageManifestDependencySection {
  return dependencySections.includes(value as PackageManifestDependencySection);
}

function isSafeDependencyName(value: string): boolean {
  return value.length > 0 && value.length <= 214 && !/[\0\r\n\t]/.test(value);
}

function sourceKind(source: PackageManifestDependencyClaimSource): string {
  const metadata = parseMetadata(source.metadataJson);
  return typeof metadata.sourceKind === "string" ? metadata.sourceKind : "";
}

function packageRootRefForManifest(sourceRef: string): string {
  const dirname = path.posix.dirname(sourceRef);
  return dirname === "." ? "." : dirname;
}

function parseMetadata(metadataJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseDiagnostics(sourceFile: ts.JsonSourceFile): readonly unknown[] {
  const candidate = sourceFile as unknown as { readonly parseDiagnostics?: readonly unknown[] };
  return candidate.parseDiagnostics ?? [];
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
