import { repoPath, unsupportedFlag, type ParsedArgs } from "../args.js";
import { errorMessage, humanizeCliWarning, repoOutputOptions, write, writeError, writeJson } from "../render.js";
import { exitCodes } from "../exit-codes.js";

export async function runArtifacts(parsed: ParsedArgs): Promise<number> {
  const flag = unsupportedFlag(parsed, new Set(["--json", "--repo", "--session", "--artifact"]));
  if (flag) {
    writeError(`Unsupported option for grape ${parsed.command}: ${flag}`);
    return exitCodes.usage;
  }

  try {
    const rootPath = repoPath(parsed);
    const outputOptions = repoOutputOptions(rootPath);
    const artifactId = parsed.values.get("--artifact");
    const { getLocalArtifact, listLocalArtifacts } = await import("../../app/local-project/inspection/artifacts.js");

    if (artifactId) {
      const result = getLocalArtifact({ rootPath, artifactId });
      if (parsed.flags.has("--json")) {
        writeJson(result, outputOptions);
        return exitCodes.ok;
      }
      write([
        `Artifact: ${result.artifactId}`,
        "",
        `Session: ${result.sessionId}`,
        `Task type: ${result.taskType}`,
        `Created: ${result.createdAt}`,
        `Artifact hash: ${result.artifactHash}`,
        `Dependency manifest: ${result.dependencyManifestHash}`,
        `Warnings: ${result.warnings.length === 0 ? "none" : result.warnings.map(humanizeCliWarning).join(", ")}`,
        `Unsafe reasons: ${result.unsafeReasons.length === 0 ? "none" : result.unsafeReasons.join(", ")}`,
        "",
        "Files:",
        `  JSON: ${result.artifactFiles.json} (${result.artifactFiles.jsonExists ? "present" : "missing"})`,
        `  Markdown: ${result.artifactFiles.markdown} (${result.artifactFiles.markdownExists ? "present" : "missing"})`,
        "",
        `Dependencies: ${result.dependencies.length}`,
        ...result.dependencies.map((dependency) => `  ${dependency.kind}: ${dependency.ref} @ ${dependency.hash}`)
      ].join("\n"), outputOptions);
      return exitCodes.ok;
    }

    const result = listLocalArtifacts({
      rootPath,
      sessionId: parsed.values.get("--session")
    });
    if (parsed.flags.has("--json")) {
      writeJson(result, outputOptions);
      return exitCodes.ok;
    }

    const emptyHint = result.artifacts.length === 0
      ? [
          "Run grape compile --task \"<task>\" --session <id> first.",
          "Then rerun grape artifacts to inspect generated JSON and Markdown artifact refs."
        ]
      : [];
    write([
      `Context artifacts: ${result.artifacts.length}`,
      "",
      ...result.artifacts.map(
        (artifact) =>
          `${artifact.artifactId}  ${artifact.sessionId}  ${artifact.taskType}  ${artifact.createdAt}`
      ),
      ...emptyHint
    ].join("\n"), outputOptions);
    return exitCodes.ok;
  } catch (error) {
    writeError(`grape artifacts failed: ${errorMessage(error)}`, repoOutputOptions(repoPath(parsed)));
    return artifactsErrorExitCode(error);
  }
}

function artifactsErrorExitCode(error: unknown): number {
  const message = errorMessage(error);
  if (message.includes("was not found")) return exitCodes.usage;
  if (message.includes("config root path does not match")) return exitCodes.stale;
  return exitCodes.storage;
}
