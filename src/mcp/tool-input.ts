export function assertAllowedFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  domain: string
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new Error(`unsupported ${domain} argument: ${key}`);
  }
}

export function assertReportedByAgent(value: unknown, message: string, required = false): void {
  if (value === undefined && !required) return;
  if (value !== "agent") throw new Error(message);
}

export function requiredString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.trim() === "") throw new Error(`${key} must be a non-empty string`);
  return field;
}

export function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== "string") throw new Error(`${key} must be a string`);
  return field;
}

export function optionalNonEmptyString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== "string" || field.trim() === "") throw new Error(`${key} must be a non-empty string`);
  return field;
}

export function requiredInteger(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (!Number.isInteger(field)) throw new Error(`${key} must be an integer`);
  return field as number;
}

export function requiredBoolean(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  if (typeof field !== "boolean") throw new Error(`${key} must be a boolean`);
  return field;
}

export function optionalBoolean(value: Record<string, unknown>, key: string): boolean | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field !== "boolean") throw new Error(`${key} must be a boolean`);
  return field;
}

export function requiredObject(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const field = value[key];
  if (!isRecord(field)) throw new Error(`${key} must be an object`);
  return field;
}

export function optionalStringArray(value: Record<string, unknown>, key: string): string[] {
  const field = value[key];
  if (field === undefined) return [];
  if (!Array.isArray(field) || field.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${key} must be an array of non-empty strings`);
  }
  return field;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
