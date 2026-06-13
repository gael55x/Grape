/**
 * Deterministic approximate token estimate (chars / 4), matching Grape in-memory accounting.
 */
export function estimateTokens(value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(serialized.length / 4);
}

export function omissionRatio(fullTokens, payloadTokens) {
  if (fullTokens <= 0) return 0;
  return Math.round((1 - payloadTokens / fullTokens) * 10000) / 100;
}
