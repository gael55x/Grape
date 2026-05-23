import { readFileSync } from "node:fs";
import { join } from "node:path";

const claimsSource = readFileSync(join(process.cwd(), "src", "core", "trust", "claims.ts"), "utf8");
const errors = [];

if (!claimsSource.includes("export type NonEmptyArray<T> = readonly [T, ...T[]];")) {
  errors.push("Durable claim proof refs must use NonEmptyArray");
}

if (!claimsSource.includes("proofRefs: NonEmptyArray<string>;")) {
  errors.push("DurableClaim must require non-empty proofRefs");
}

if (!claimsSource.includes('verificationStatus: Extract<VerificationStatus, "verified">;')) {
  errors.push("DurableClaim must be verified only");
}

if (!claimsSource.includes('scopeResult: Extract<ScopeMatchResult, "match">;')) {
  errors.push("DurableClaim must require matched scope");
}

if (claimsSource.includes("proofRefs?:")) {
  errors.push("DurableClaim proofRefs must not be optional");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("trust shapes ok");
