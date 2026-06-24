import { languageForPath } from "./index-paths.js";

export type LanguageProviderCapability =
  | "lexical_path"
  | "symbols_basic"
  | "symbols_ast"
  | "module_edges"
  | "test_edges"
  | "framework_edges"
  | "type_aware_edges"
  | "runtime_edges";

export type LanguageProviderDiagnosticCode = "provider_capability_gap";

export interface LanguageProviderDiagnostic {
  readonly code: LanguageProviderDiagnosticCode;
  readonly severity: "info" | "warning";
  readonly capability: LanguageProviderCapability;
}

export interface LanguageProviderMetadata {
  readonly language: string;
  readonly providerId: "typescript_ast" | "generic_text";
  readonly providerCapabilities: readonly LanguageProviderCapability[];
  readonly providerDiagnostics: readonly LanguageProviderDiagnostic[];
  readonly providerBlindSpots: readonly string[];
}

export type FileIndexExtractor = "typescript_ast" | "regex_basic";

const typescriptAstCapabilities: readonly LanguageProviderCapability[] = [
  "lexical_path",
  "symbols_ast",
  "module_edges",
  "test_edges",
  "type_aware_edges"
];

const genericTextCapabilities: readonly LanguageProviderCapability[] = [
  "lexical_path",
  "symbols_basic"
];

export function languageProviderForFile(repoPath: string, extractor: FileIndexExtractor): LanguageProviderMetadata {
  const language = languageForPath(repoPath);
  if (extractor === "typescript_ast") {
    return {
      language,
      providerId: "typescript_ast",
      providerCapabilities: typescriptAstCapabilities,
      providerDiagnostics: [],
      providerBlindSpots: ["dynamic_imports", "framework_magic", "dependency_injection", "generated_code"]
    };
  }

  return {
    language,
    providerId: "generic_text",
    providerCapabilities: genericTextCapabilities,
    providerDiagnostics: [
      capabilityGap("module_edges"),
      capabilityGap("test_edges")
    ],
    providerBlindSpots: ["unsupported_language_graph", "framework_magic", "generated_code"]
  };
}

export function languageProviderMetadataFields(provider: LanguageProviderMetadata): Record<string, unknown> {
  return {
    providerId: provider.providerId,
    providerCapabilities: [...provider.providerCapabilities],
    providerDiagnostics: provider.providerDiagnostics.map((diagnostic) => ({ ...diagnostic })),
    providerBlindSpots: [...provider.providerBlindSpots]
  };
}

function capabilityGap(capability: LanguageProviderCapability): LanguageProviderDiagnostic {
  return {
    code: "provider_capability_gap",
    severity: "warning",
    capability
  };
}
