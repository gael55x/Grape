export const exitCodes = {
  ok: 0,
  usage: 1,
  unsafe: 2,
  stale: 3,
  storage: 4,
  lock: 5,
  sessionMismatch: 6
} as const;
