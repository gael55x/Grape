import { readIndexableText } from "./indexable-source-reader.js";
import { parseTypeScriptAstIndex } from "./typescript-ast-index.js";
import { detectRegexSymbols, moduleNodeForFile, symbolNodeForAstSymbol } from "./file-index-nodes.js";
import { fileIndexEdgesForParsedFiles } from "./file-index-edges.js";
import type {
  FileIndexInput,
  FileIndexNode,
  FileIndexResult,
  FileIndexSkip,
  FileIndexSource,
  ParsedFileIndex
} from "./file-index-types.js";

export type {
  FileIndexInput,
  FileIndexNode,
  FileIndexResult,
  FileIndexSkip,
  FileIndexSource
} from "./file-index-types.js";

const sourceLikeKinds = new Set<FileIndexSource["sourceKind"]>(["source", "test", "config", "package", "rule"]);

export function buildFileIndex(input: FileIndexInput): FileIndexResult {
  const files = input.files.filter((file) => sourceLikeKinds.has(file.sourceKind));
  const filePaths = new Set(files.map((file) => file.path));
  const nodes: FileIndexNode[] = [];
  const skipped: FileIndexSkip[] = [];
  const parsedFiles: ParsedFileIndex[] = [];

  for (const file of files) {
    const readResult = readIndexableText(input.rootPath, file);
    if (readResult.status === "skipped") {
      skipped.push({ path: file.path, reason: readResult.reason });
      continue;
    }

    const ast = parseTypeScriptAstIndex(file.path, readResult.text);
    const moduleNode = moduleNodeForFile(input, file, ast ? "typescript_ast" : "regex_basic");
    const symbols = ast
      ? ast.symbols.map((symbol) => symbolNodeForAstSymbol(input, file, symbol))
      : detectRegexSymbols(input, file, readResult.text);

    nodes.push(moduleNode, ...symbols);
    parsedFiles.push({ file, moduleNode, symbols, ast, text: readResult.text });
  }

  return {
    nodes,
    edges: fileIndexEdgesForParsedFiles(input, parsedFiles, nodes, filePaths),
    skipped
  };
}
