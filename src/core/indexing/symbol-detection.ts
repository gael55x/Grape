import type { SymbolConfidence, SymbolKind } from "../storage/index.js";

export interface DetectedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly confidence: SymbolConfidence;
}

export function detectSymbolOnLine(line: string): DetectedSymbol | undefined {
  const trimmed = line.trim();
  const functionMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const classMatch = /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (classMatch) return { name: classMatch[1], kind: "class", confidence: "medium" };

  const interfaceMatch = /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (interfaceMatch) return { name: interfaceMatch[1], kind: "interface", confidence: "medium" };

  const typeMatch = /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (typeMatch) return { name: typeMatch[1], kind: "type", confidence: "medium" };

  const constMatch = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (constMatch) return { name: constMatch[1], kind: "constant", confidence: "medium" };

  const variableMatch = /^(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (variableMatch) return { name: variableMatch[1], kind: "variable", confidence: "low" };

  return undefined;
}
