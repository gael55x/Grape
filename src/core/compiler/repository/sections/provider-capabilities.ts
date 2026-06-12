import { selectedSymbolNodes } from "../selection/index.js";
import type { CompileRepositoryContextArtifactInput } from "../types.js";
import { preferredSourceRefs } from "./task-selection.js";

interface ProviderSummary {
  readonly language: string;
  readonly providerId: string;
  readonly fileCount?: number;
  readonly capabilities: readonly string[];
  readonly gaps: readonly string[];
}

interface PackageProviderSummary extends ProviderSummary {
  readonly packageRoot: string;
}

export function providerCapabilityReportLines(
  input: CompileRepositoryContextArtifactInput
): readonly string[] {
  const fallbackLanguages = selectedFallbackLanguages(input);
  const providerSummaries = selectedProviderSummaries(input);
  const packageProviderSummaries = selectedPackageProviderSummaries(input);
  const indexedProviderSummaries = indexedProviderSummariesByLanguage(input);

  return [
    ...fallbackLanguageLines(fallbackLanguages),
    ...selectedProviderCapabilityLines(providerSummaries),
    ...selectedPackageProviderCapabilityLines(packageProviderSummaries),
    ...indexedProviderCapabilityLines(indexedProviderSummaries)
  ];
}

function selectedFallbackLanguages(input: CompileRepositoryContextArtifactInput): readonly string[] {
  const preferredRefs = preferredSourceRefs(input);
  const languages = new Set<string>();
  for (const node of selectedSymbolNodes(input.symbolNodes, preferredRefs)) {
    if (node.language === "typescript" || node.language === "typescript_tsx") continue;
    if (node.language === "javascript" || node.language === "javascript_jsx") continue;
    languages.add(node.language);
  }
  return [...languages].sort();
}

function selectedProviderSummaries(input: CompileRepositoryContextArtifactInput): readonly ProviderSummary[] {
  const preferredRefs = preferredSourceRefs(input);
  const summaries = new Map<string, {
    language: string;
    providerId: string;
    capabilities: Set<string>;
    gaps: Set<string>;
  }>();

  for (const node of selectedSymbolNodes(input.symbolNodes, preferredRefs)) {
    const metadata = parseMetadataJson(node.metadataJson);
    const providerId = stringField(metadata, "providerId") ?? "unknown";
    const key = `${node.language}\0${providerId}`;
    const summary = summaries.get(key) ?? {
      language: node.language,
      providerId,
      capabilities: new Set<string>(),
      gaps: new Set<string>()
    };
    addProviderMetadata(summary, metadata);
    summaries.set(key, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      language: summary.language,
      providerId: summary.providerId,
      capabilities: [...summary.capabilities].sort(),
      gaps: [...summary.gaps].sort()
    }))
    .sort(compareProviderSummary);
}

function selectedPackageProviderSummaries(
  input: CompileRepositoryContextArtifactInput
): readonly PackageProviderSummary[] {
  const preferredRefs = preferredSourceRefs(input);
  const summaries = new Map<string, {
    packageRoot: string;
    language: string;
    providerId: string;
    sourceRefs: Set<string>;
    capabilities: Set<string>;
    gaps: Set<string>;
  }>();

  for (const node of selectedSymbolNodes(input.symbolNodes, preferredRefs)) {
    const metadata = parseMetadataJson(node.metadataJson);
    const packageRoot = packageRootFromMetadata(node.path, metadata);
    if (!packageRoot) continue;
    const providerId = stringField(metadata, "providerId") ?? "unknown";
    const key = `${packageRoot}\0${node.language}\0${providerId}`;
    const summary = summaries.get(key) ?? {
      packageRoot,
      language: node.language,
      providerId,
      sourceRefs: new Set<string>(),
      capabilities: new Set<string>(),
      gaps: new Set<string>()
    };
    summary.sourceRefs.add(node.path);
    addProviderMetadata(summary, metadata);
    summaries.set(key, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      packageRoot: summary.packageRoot,
      language: summary.language,
      providerId: summary.providerId,
      fileCount: summary.sourceRefs.size,
      capabilities: [...summary.capabilities].sort(),
      gaps: [...summary.gaps].sort()
    }))
    .sort((left, right) => {
      const packageOrder = left.packageRoot.localeCompare(right.packageRoot);
      if (packageOrder !== 0) return packageOrder;
      return compareProviderSummary(left, right);
    });
}

function indexedProviderSummariesByLanguage(input: CompileRepositoryContextArtifactInput): readonly ProviderSummary[] {
  const summaries = new Map<string, {
    language: string;
    providerId: string;
    sourceRefs: Set<string>;
    capabilities: Set<string>;
    gaps: Set<string>;
  }>();

  for (const node of input.symbolNodes) {
    if (node.symbolKind !== "module") continue;
    const metadata = parseMetadataJson(node.metadataJson);
    const providerId = stringField(metadata, "providerId") ?? "unknown";
    const key = `${node.language}\0${providerId}`;
    const summary = summaries.get(key) ?? {
      language: node.language,
      providerId,
      sourceRefs: new Set<string>(),
      capabilities: new Set<string>(),
      gaps: new Set<string>()
    };
    summary.sourceRefs.add(node.path);
    addProviderMetadata(summary, metadata);
    summaries.set(key, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      language: summary.language,
      providerId: summary.providerId,
      fileCount: summary.sourceRefs.size,
      capabilities: [...summary.capabilities].sort(),
      gaps: [...summary.gaps].sort()
    }))
    .sort(compareProviderSummary);
}

function fallbackLanguageLines(languages: readonly string[]): readonly string[] {
  if (languages.length === 0) return [];
  return [
    `Generic text fallback selected languages: ${languages.join(", ")}.`,
    "Fallback can quote exact spans and match paths or text. It does not prove module edges, test edges, framework routes, types, or runtime behavior."
  ];
}

function selectedProviderCapabilityLines(summaries: readonly ProviderSummary[]): readonly string[] {
  if (summaries.length === 0) return [];
  return [
    "Selected provider capability summary:",
    ...summaries.map((summary) =>
      `- ${summary.language} via ${summary.providerId}: capabilities ${listOrNone(summary.capabilities)}; gaps ${listOrNone(summary.gaps)}.`
    )
  ];
}

function selectedPackageProviderCapabilityLines(
  summaries: readonly PackageProviderSummary[]
): readonly string[] {
  if (summaries.length === 0) return [];
  return [
    "Selected package provider capability summary:",
    ...summaries.map((summary) =>
      [
        `- ${summary.packageRoot}: ${summary.language} via ${summary.providerId};`,
        `files ${summary.fileCount ?? 0};`,
        `capabilities ${listOrNone(summary.capabilities)};`,
        `gaps ${listOrNone(summary.gaps)}.`
      ].join(" ")
    )
  ];
}

function indexedProviderCapabilityLines(summaries: readonly ProviderSummary[]): readonly string[] {
  if (summaries.length === 0) return [];
  return [
    "Indexed provider capability summary:",
    ...summaries.map((summary) =>
      [
        `- ${summary.language} via ${summary.providerId}:`,
        `files ${summary.fileCount ?? 0};`,
        `capabilities ${listOrNone(summary.capabilities)};`,
        `gaps ${listOrNone(summary.gaps)}.`
      ].join(" ")
    )
  ];
}

function addProviderMetadata(
  summary: { capabilities: Set<string>; gaps: Set<string> },
  metadata: Record<string, unknown> | undefined
): void {
  for (const capability of stringArrayField(metadata, "providerCapabilities")) {
    summary.capabilities.add(capability);
  }
  for (const gap of providerCapabilityGaps(metadata)) {
    summary.gaps.add(gap);
  }
}

function packageRootFromMetadata(
  sourceRef: string,
  metadata: Record<string, unknown> | undefined
): string | undefined {
  const packageRoot = stringField(metadata, "packageRoot") ?? stringField(metadata, "manifestPackageRoot");
  if (!packageRoot || packageRoot === ".") return undefined;
  return sourceRef === packageRoot || sourceRef.startsWith(`${packageRoot}/`) ? packageRoot : undefined;
}

function compareProviderSummary(left: ProviderSummary, right: ProviderSummary): number {
  const languageOrder = left.language.localeCompare(right.language);
  if (languageOrder !== 0) return languageOrder;
  return left.providerId.localeCompare(right.providerId);
}

function parseMetadataJson(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function stringField(value: Record<string, unknown> | undefined, key: string): string | undefined {
  const field = value?.[key];
  return typeof field === "string" ? field : undefined;
}

function stringArrayField(value: Record<string, unknown> | undefined, key: string): readonly string[] {
  const field = value?.[key];
  if (!Array.isArray(field)) return [];
  return field.filter((item): item is string => typeof item === "string");
}

function providerCapabilityGaps(value: Record<string, unknown> | undefined): readonly string[] {
  const diagnostics = value?.providerDiagnostics;
  if (!Array.isArray(diagnostics)) return [];

  const gaps: string[] = [];
  for (const diagnostic of diagnostics) {
    if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) continue;
    const record = diagnostic as Record<string, unknown>;
    if (record.code !== "provider_capability_gap" || typeof record.capability !== "string") continue;
    gaps.push(record.capability);
  }
  return gaps;
}

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}
