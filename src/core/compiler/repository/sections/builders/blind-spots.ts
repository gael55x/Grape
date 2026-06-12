import type { InMemoryContextSectionShape } from "../../../../../shared/index.js";
import { repositoryContextSection as section } from "../factory.js";
import { preferredSourceRefs } from "../task-selection.js";
import { selectedSymbolNodes } from "../../selection/index.js";
import type { CompileRepositoryContextArtifactInput } from "../../types.js";

export function blindSpotSection(input: CompileRepositoryContextArtifactInput): InMemoryContextSectionShape {
  const fallbackLanguages = selectedFallbackLanguages(input);
  const providerSummaries = selectedProviderSummaries(input);

  return section({
    id: "index-blind-spots",
    type: "stale_warning",
    title: "Index Confidence",
    body: [
      "This artifact uses the lightweight file index.",
      "It is an impact candidate set, not a complete call graph.",
      ...fallbackLanguageLines(fallbackLanguages),
      ...providerCapabilityLines(providerSummaries),
      "Regex import/symbol extraction can miss dynamic imports, framework routing, dependency injection, and generated code.",
      "No durable claims are promoted from this artifact without proof validation."
    ].join("\n"),
    dependencyRefs: ["repo-snapshot", "worktree-state"],
    pinned: input.taskType === "refactor" || input.riskOverlays.length > 0,
    exactRequired: false
  });
}

interface ProviderSummary {
  readonly language: string;
  readonly providerId: string;
  readonly capabilities: readonly string[];
  readonly gaps: readonly string[];
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
    for (const capability of stringArrayField(metadata, "providerCapabilities")) {
      summary.capabilities.add(capability);
    }
    for (const gap of providerCapabilityGaps(metadata)) {
      summary.gaps.add(gap);
    }
    summaries.set(key, summary);
  }

  return [...summaries.values()]
    .map((summary) => ({
      language: summary.language,
      providerId: summary.providerId,
      capabilities: [...summary.capabilities].sort(),
      gaps: [...summary.gaps].sort()
    }))
    .sort((left, right) => {
      const languageOrder = left.language.localeCompare(right.language);
      if (languageOrder !== 0) return languageOrder;
      return left.providerId.localeCompare(right.providerId);
    });
}

function fallbackLanguageLines(languages: readonly string[]): readonly string[] {
  if (languages.length === 0) return [];
  return [
    `Generic text fallback selected languages: ${languages.join(", ")}.`,
    "Fallback can quote exact spans and match paths or text. It does not prove module edges, test edges, framework routes, types, or runtime behavior."
  ];
}

function providerCapabilityLines(summaries: readonly ProviderSummary[]): readonly string[] {
  if (summaries.length === 0) return [];
  return [
    "Selected provider capability summary:",
    ...summaries.map((summary) =>
      `- ${summary.language} via ${summary.providerId}: capabilities ${listOrNone(summary.capabilities)}; gaps ${listOrNone(summary.gaps)}.`
    )
  ];
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
