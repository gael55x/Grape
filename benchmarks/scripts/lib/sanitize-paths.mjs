import os from "node:os";
import path from "node:path";

/**
 * Redact machine-specific absolute paths from benchmark log/detail strings.
 * Keeps repo-relative meaning via <repo-root> without leaking home directories.
 */
export function sanitizeReportText(text, root = process.cwd()) {
  if (!text || typeof text !== "string") {
    return text;
  }

  const repoRoot = path.resolve(root);
  const home = os.homedir();

  let sanitized = text.split(repoRoot).join("<repo-root>");
  if (home) {
    sanitized = sanitized.split(home).join("<home>");
  }

  // Collapse remaining absolute POSIX paths and macOS /private prefixes.
  sanitized = sanitized.replace(/\/private(?=\/)/g, "");
  sanitized = sanitized.replace(/(?:^|\s)(\/(?:Users|home|var|tmp|private)[^\s"'`,;)}\]]+)/g, (match, absolutePath) => {
    return match.replace(absolutePath, "<absolute-path>");
  });

  return sanitized;
}
