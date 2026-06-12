import type { SymbolConfidence, SymbolKind } from "../storage/index.js";

export interface DetectedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly confidence: SymbolConfidence;
}

export function detectSymbolOnLine(line: string, language: string): DetectedSymbol | undefined {
  const trimmed = line.trim();
  const syntaxSymbol = isJsLikeLanguage(language) ? detectJsLikeSymbol(trimmed) : undefined;
  if (syntaxSymbol) return syntaxSymbol;

  const languageSymbol = detectLanguageSymbol(trimmed, language);
  if (languageSymbol) return languageSymbol;

  return detectJsLikeSymbol(trimmed);
}

function isJsLikeLanguage(language: string): boolean {
  return (
    language === "typescript" ||
    language === "typescript_tsx" ||
    language === "javascript" ||
    language === "javascript_jsx" ||
    language === "unknown"
  );
}

function detectLanguageSymbol(trimmed: string, language: string): DetectedSymbol | undefined {
  switch (language) {
    case "python":
      return detectPythonSymbol(trimmed);
    case "go":
      return detectGoSymbol(trimmed);
    case "rust":
      return detectRustSymbol(trimmed);
    case "java":
      return detectJvmOrDotnetSymbol(trimmed);
    case "kotlin":
      return detectKotlinSymbol(trimmed) ?? detectJvmOrDotnetSymbol(trimmed);
    case "csharp":
      return detectJvmOrDotnetSymbol(trimmed);
    case "ruby":
      return detectRubySymbol(trimmed);
    case "php":
      return detectPhpSymbol(trimmed);
    case "swift":
      return detectSwiftSymbol(trimmed);
    case "c":
    case "c_header":
    case "cpp":
      return detectNativeSymbol(trimmed);
    case "shell":
      return detectShellSymbol(trimmed);
    default:
      return undefined;
  }
}

function detectJsLikeSymbol(trimmed: string): DetectedSymbol | undefined {
  const functionMatch = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const classMatch = /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (classMatch) return { name: classMatch[1], kind: "class", confidence: "medium" };

  const interfaceMatch = /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (interfaceMatch) return { name: interfaceMatch[1], kind: "interface", confidence: "medium" };

  const typeMatch = /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (typeMatch) return { name: typeMatch[1], kind: "type", confidence: "medium" };

  const constFunctionMatch =
    /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.exec(
      trimmed
    );
  if (constFunctionMatch) return { name: constFunctionMatch[1], kind: "function", confidence: "medium" };

  const constMatch = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (constMatch) return { name: constMatch[1], kind: "constant", confidence: "medium" };

  const variableMatch = /^(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)/.exec(trimmed);
  if (variableMatch) return { name: variableMatch[1], kind: "variable", confidence: "low" };

  return undefined;
}

function detectPythonSymbol(trimmed: string): DetectedSymbol | undefined {
  const functionMatch = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const classMatch = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmed);
  if (classMatch) return { name: classMatch[1], kind: "class", confidence: "medium" };

  return undefined;
}

function detectGoSymbol(trimmed: string): DetectedSymbol | undefined {
  const functionMatch = /^func\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const typeMatch = /^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+(struct|interface)\b/.exec(trimmed);
  if (typeMatch) {
    return {
      name: typeMatch[1],
      kind: typeMatch[2] === "interface" ? "interface" : "class",
      confidence: "medium"
    };
  }

  return undefined;
}

function detectRustSymbol(trimmed: string): DetectedSymbol | undefined {
  const functionMatch = /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*[<(]/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const typeMatch = /^(?:pub(?:\([^)]*\))?\s+)?(struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmed);
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: rustTypeKind(typeMatch[1]),
      confidence: "medium"
    };
  }

  return undefined;
}

function detectJvmOrDotnetSymbol(trimmed: string): DetectedSymbol | undefined {
  const typeMatch =
    /^(?:(?:public|private|protected|internal|sealed|final|static|abstract|open|data|enum|value|partial|record)\s+)*(class|interface|enum|record|object)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(
      trimmed
    );
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: classLikeTypeKind(typeMatch[1]),
      confidence: "medium"
    };
  }

  const methodMatch =
    /^(?:(?:public|private|protected|internal|static|final|abstract|override|async|sealed|virtual|suspend|inline|operator|open|new)\s+)*(?:[A-Za-z_][A-Za-z0-9_<>,.?[\]\s]*\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(
      trimmed
    );
  if (methodMatch) return { name: methodMatch[1], kind: "method", confidence: "medium" };

  const propertyMatch =
    /^(?:(?:public|private|protected|internal|static|readonly|const|sealed|override|virtual|abstract|new)\s+)*(?:[A-Za-z_][A-Za-z0-9_<>,.?[\]\s]*\s+)+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=>|[;={])/.exec(
      trimmed
    );
  if (propertyMatch) return { name: propertyMatch[1], kind: "constant", confidence: "low" };

  return undefined;
}

function detectKotlinSymbol(trimmed: string): DetectedSymbol | undefined {
  const functionMatch = /^(?:(?:public|private|protected|internal|suspend|inline|operator|override|open)\s+)*fun\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const propertyMatch = /^(?:(?:public|private|protected|internal|override|open)\s+)*(?:val|var)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmed);
  if (propertyMatch) return { name: propertyMatch[1], kind: "constant", confidence: "low" };

  return undefined;
}

function detectRubySymbol(trimmed: string): DetectedSymbol | undefined {
  const classMatch = /^class\s+([A-Za-z_][A-Za-z0-9_:]*)\b/.exec(trimmed);
  if (classMatch) return { name: classMatch[1], kind: "class", confidence: "medium" };

  const functionMatch = /^def\s+(?:self\.)?([A-Za-z_][A-Za-z0-9_]*(?:[?!])?)(?:\s|\(|$)/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "method", confidence: "medium" };

  return undefined;
}

function detectPhpSymbol(trimmed: string): DetectedSymbol | undefined {
  const typeMatch = /^(?:abstract\s+|final\s+)?(class|interface|trait)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmed);
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: classLikeTypeKind(typeMatch[1]),
      confidence: "medium"
    };
  }

  const functionMatch = /^(?:(?:public|protected|private|static|final|abstract)\s+)*function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "method", confidence: "medium" };

  return undefined;
}

function detectSwiftSymbol(trimmed: string): DetectedSymbol | undefined {
  const typeMatch =
    /^(?:(?:public|private|internal|fileprivate|open|final)\s+)*(class|struct|protocol|enum|actor)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(
      trimmed
    );
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: swiftTypeKind(typeMatch[1]),
      confidence: "medium"
    };
  }

  const functionMatch =
    /^(?:(?:public|private|internal|fileprivate|open|static|final|class|mutating|nonmutating|override)\s+)*func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(
      trimmed
    );
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const propertyMatch =
    /^(?:(?:public|private|internal|fileprivate|open|static|final|class)\s+)*(let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(
      trimmed
    );
  if (propertyMatch) {
    return {
      name: propertyMatch[2],
      kind: propertyMatch[1] === "let" ? "constant" : "variable",
      confidence: "low"
    };
  }

  return undefined;
}

function rustTypeKind(keyword: string): SymbolKind {
  if (keyword === "trait") return "interface";
  if (keyword === "struct") return "class";
  return "type";
}

function classLikeTypeKind(keyword: string): SymbolKind {
  if (keyword === "interface") return "interface";
  if (keyword === "class" || keyword === "object") return "class";
  return "type";
}

function swiftTypeKind(keyword: string): SymbolKind {
  if (keyword === "protocol") return "interface";
  if (keyword === "enum") return "type";
  return "class";
}

function detectNativeSymbol(trimmed: string): DetectedSymbol | undefined {
  const typeMatch = /^(?:template\s*<[^>]+>\s*)?(class|struct|enum)\s+([A-Za-z_][A-Za-z0-9_]*)\b/.exec(trimmed);
  if (typeMatch) {
    return {
      name: typeMatch[2],
      kind: typeMatch[1] === "enum" ? "type" : "class",
      confidence: "medium"
    };
  }

  const functionMatch =
    /^(?:(?:static|inline|extern|constexpr|consteval|virtual|unsigned|signed|long|short|const)\s+)*(?:[A-Za-z_~][A-Za-z0-9_:<>\s*&]*\s+)+([A-Za-z_~][A-Za-z0-9_]*)\s*\([^;]*\)\s*(?:\{|$)/.exec(
      trimmed
    );
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  return undefined;
}

function detectShellSymbol(trimmed: string): DetectedSymbol | undefined {
  const functionMatch = /^(?:function\s+)?([A-Za-z_][A-Za-z0-9_-]*)\s*\(\)\s*\{?/.exec(trimmed);
  if (functionMatch) return { name: functionMatch[1], kind: "function", confidence: "medium" };

  const assignmentMatch = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(trimmed);
  if (assignmentMatch) return { name: assignmentMatch[1], kind: "variable", confidence: "low" };

  return undefined;
}
