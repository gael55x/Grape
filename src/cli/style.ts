export type CliOutputStream = "stdout" | "stderr";

export interface CliStyleOptions {
  readonly color?: boolean;
  readonly stream?: CliOutputStream;
}

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  grape: "\u001b[38;2;165;139;204m",
  leaf: "\u001b[38;2;74;222;128m",
  red: "\u001b[31m",
  yellow: "\u001b[33m"
} as const;

export function shouldUseColor(stream: NodeJS.WriteStream, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NO_COLOR !== undefined) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") return true;
  if (env.TERM === "dumb") return false;
  return stream.isTTY === true;
}

export function styleHumanOutput(message: string, options: CliStyleOptions = {}): string {
  const useColor = options.color ?? shouldUseColor(options.stream === "stderr" ? process.stderr : process.stdout);
  if (!useColor) return message;

  const stream = options.stream ?? "stdout";
  return message
    .split("\n")
    .map((line) => styleLine(line, stream))
    .join("\n");
}

function styleLine(line: string, stream: CliOutputStream): string {
  if (line.length === 0 || isJsonLine(line)) return line;
  if (stream === "stderr") return styleErrorLine(line);

  if (/^Grape\b/.test(line)) return paint(line, "grape", "bold");
  if (/^(Wrote|Updated)\b/.test(line)) return paint(line, "leaf", "bold");
  if (/^Dry run:/.test(line) || /already configured/.test(line)) return paint(line, "grape", "bold");
  if (isSectionHeading(line)) return paint(line, "leaf", "bold");
  if (/^\s+grape\b/.test(line)) return styleCommandLine(line);
  if (/^\s+[A-Z][A-Za-z /-]+:/.test(line)) return colorLabel(line);

  return line
    .replace(/\bPASS\b/g, paint("PASS", "leaf", "bold"))
    .replace(/\bWARN\b/g, paint("WARN", "yellow", "bold"))
    .replace(/\bFAIL\b/g, paint("FAIL", "red", "bold"));
}

function styleErrorLine(line: string): string {
  if (isSectionHeading(line) || /^\s*Recovery:/.test(line)) return paint(line, "leaf", "bold");
  if (/^\s+grape\b/.test(line)) return styleCommandLine(line);
  return paint(line, "red");
}

function styleCommandLine(line: string): string {
  const helpRow = /^(\s*)(grape\b.*?)(\s{2,})(\S.*)$/.exec(line);
  if (helpRow) {
    return `${helpRow[1]}${paint(helpRow[2], "grape")}${helpRow[3]}${helpRow[4]}`;
  }

  return line.replace(/grape.*/, (match) => paint(match, "grape"));
}

function colorLabel(line: string): string {
  const match = /^(\s+[A-Z][A-Za-z /-]+:)(.*)$/.exec(line);
  if (!match) return line;
  return `${paint(match[1], "leaf")}${match[2]}`;
}

function isSectionHeading(line: string): boolean {
  return /^[A-Z][A-Za-z /-]+:$/.test(line);
}

function isJsonLine(line: string): boolean {
  return /^\s*[{}\[\],]\s*$/.test(line) || /^\s*"[^"]+":/.test(line) || /^\s*"[^"]+"\s*,?\s*$/.test(line);
}

function paint(text: string, color: "grape" | "leaf" | "red" | "yellow", weight?: "bold"): string {
  const prefix = `${weight === "bold" ? ANSI.bold : ""}${ANSI[color]}`;
  return `${prefix}${text}${ANSI.reset}`;
}
