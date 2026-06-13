import {
  languageProviderForFile,
  type FileIndexExtractor,
  type LanguageProviderMetadata
} from "./language-provider.js";
import { parseTypeScriptAstIndex, type TypeScriptAstIndexResult } from "./typescript-ast-index.js";

export interface FileIndexProviderSelection {
  readonly ast?: TypeScriptAstIndexResult;
  readonly extractor: FileIndexExtractor;
  readonly provider: LanguageProviderMetadata;
}

export function selectFileIndexProvider(repoPath: string, content: string): FileIndexProviderSelection {
  const ast = parseTypeScriptAstIndex(repoPath, content);
  const extractor: FileIndexExtractor = ast ? "typescript_ast" : "regex_basic";

  return {
    ast,
    extractor,
    provider: languageProviderForFile(repoPath, extractor)
  };
}
