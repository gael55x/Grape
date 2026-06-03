export function summarizeToolResult(toolName: string, value: unknown): string {
  if (!isRecord(value)) return `${toolName}: result available in structuredContent`;

  switch (toolName) {
    case "grape_get_context":
      return summarizeGetContext(value);
    case "grape_get_artifact":
      return summarizeFields(toolName, value, ["artifactId", "artifactHash", "dependencyManifestHash"]);
    case "grape_get_omitted_item":
      return summarizeFields(toolName, value, ["status", "artifactId", "sectionId"]);
    case "grape_get_status":
      return summarizeFields(toolName, value, ["status", "initialized", "databaseReady"]);
    case "grape_get_stale_items":
      return summarizeFields(toolName, value, ["inspectedSessionCount", "staleItemCount"]);
    case "grape_get_claims":
      return `${toolName}: ${arrayLength(value.claims)} claims; see structuredContent`;
    case "grape_get_proofs":
      return `${toolName}: ${arrayLength(value.proofs)} proofs; see structuredContent`;
    case "grape_get_rules":
      return `${toolName}: ${arrayLength(value.rules)} rules; see structuredContent`;
    case "grape_get_conflicts":
      return `${toolName}: ${arrayLength(value.conflicts)} conflicts; see structuredContent`;
    default:
      return summarizeFields(toolName, value, ["status", "sourceId", "candidateId", "confirmationRequestId"]);
  }
}

function summarizeGetContext(value: Record<string, unknown>): string {
  return [
    "grape_get_context:",
    `mode=${stringField(value.outputMode) ?? "agent_pack"}`,
    `compileMode=${stringField(value.compileMode) ?? "unknown"}`,
    `session=${stringField(value.sessionId) ?? "unknown"}`,
    `artifact=${stringField(value.artifactId) ?? "unknown"}`,
    `packItems=${arrayLength(value.contextPackItems)}`,
    `restore=${booleanField(value.restoreAvailable) ? "yes" : "no"}`,
    "see structuredContent"
  ].join(" ");
}

function summarizeFields(toolName: string, value: Record<string, unknown>, fields: readonly string[]): string {
  const parts = fields.flatMap((field) => {
    const output = fieldValue(value[field]);
    return output ? [`${field}=${output}`] : [];
  });
  return `${toolName}: ${parts.length > 0 ? parts.join(" ") : "result available"}; see structuredContent`;
}

function fieldValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function booleanField(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
