export const taskTypes = [
  "bug_fix",
  "security_fix",
  "refactor",
  "migration",
  "feature",
  "test_repair",
  "analysis",
  "bootstrap"
] as const;

export type TaskType = (typeof taskTypes)[number];

export const riskOverlays = [
  "security",
  "auth",
  "permissions",
  "payments",
  "webhooks",
  "secrets",
  "crypto",
  "migration",
  "production_config"
] as const;

export type RiskOverlay = (typeof riskOverlays)[number];

export const diffStates = [
  "NEW",
  "CHANGED",
  "PINNED",
  "OMIT_UNCHANGED",
  "INVALIDATE_PREVIOUS",
  "RESTORE_AVAILABLE"
] as const;

export type DiffState = (typeof diffStates)[number];

export const sourceTypes = [
  "repository_file",
  "git_diff",
  "test_run",
  "command_run",
  "user_message",
  "tool_call",
  "runtime_log",
  "ci_job",
  "assistant_response",
  "manual_import",
  "rule_file",
  "config_file",
  "lockfile",
  "migration_file",
  "commit_message"
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const sourceScopes = ["committed", "staged", "unstaged", "untracked", "external"] as const;

export type SourceScope = (typeof sourceScopes)[number];

export const sourceTrustClasses = ["trusted", "temporary", "untrusted"] as const;

export type SourceTrustClass = (typeof sourceTrustClasses)[number];

export const privacyStatuses = ["allowed", "ignored", "private", "blocked_secret"] as const;

export type PrivacyStatus = (typeof privacyStatuses)[number];

export const sourceRedactionStatuses = ["not_needed", "redacted", "blocked"] as const;

export type SourceRedactionStatus = (typeof sourceRedactionStatuses)[number];

export const verificationStatuses = [
  "verified",
  "partially_verified",
  "unverified",
  "refuted",
  "stale"
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export const scopeMatchResults = ["match", "mismatch", "partial", "unknown"] as const;

export type ScopeMatchResult = (typeof scopeMatchResults)[number];

export const compressionArtifactTypes = [
  "symbol_outline",
  "rule_digest",
  "context_pack_summary",
  "decision_digest",
  "failure_timeline",
  "module_outline",
  "test_summary"
] as const;

export type CompressionArtifactType = (typeof compressionArtifactTypes)[number];

export type CompressionMethod = "deterministic";

export type NonEmptyArray<T> = readonly [T, ...T[]];

export interface InMemoryContextRequest {
  taskId: string;
  sessionId: string;
  repoId: string;
  branch: string;
  commit: string;
  worktreeHash: string;
  taskType: TaskType;
  riskOverlays: RiskOverlay[];
  userRequestHash: string;
}

export interface InMemoryContextSectionShape {
  id: string;
  type:
    | "task"
    | "pinned_rule"
    | "active_claim"
    | "code_span"
    | "test_span"
    | "config_span"
    | "risk_warning"
    | "stale_warning"
    | "contradiction"
    | "compression_orientation"
    | "omission_notice";
  title: string;
  body: string;
  sourceRefs: string[];
  proofRefs: string[];
  dependencyRefs: string[];
  contentHash: string;
  pinned: boolean;
  exactRequired: boolean;
  redactionStatus: "clean" | "redacted" | "blocked";
}

export interface InMemoryContextDependencyShape {
  id: string;
  kind:
    | "repo_snapshot"
    | "worktree_state"
    | "source"
    | "source_file"
    | "config"
    | "lockfile"
    | "proof"
    | "claim"
    | "rule"
    | "symbol"
    | "test"
    | "compression_artifact"
    | "session_ledger";
  ref: string;
  hash: string;
  scope: Record<string, unknown>;
}

export interface InMemoryContextDependencyManifestShape {
  manifestId: string;
  dependencies: InMemoryContextDependencyShape[];
  createdAt: string;
  hashAlgorithm: "sha256";
  manifestHash: string;
}

export interface InMemoryContextPackItemShape {
  itemId: string;
  artifactId: string;
  sessionId: string;
  sectionId: string;
  state: DiffState;
  title: string;
  body: string;
  contentHash: string;
  previousItemId?: string;
  restoreToken?: string;
  safeOmissionReason?: "unchanged_restorable";
  pinned: boolean;
  warnings: string[];
}

export interface InMemoryContextArtifactShape {
  artifactId: string;
  input: InMemoryContextRequest;
  sections: InMemoryContextSectionShape[];
  dependencyManifest: InMemoryContextDependencyManifestShape;
  warnings: string[];
  unsafeReasons: string[];
  createdAt: string;
  artifactHash: string;
}

export interface ProofRef {
  proofId: string;
  sourceId: string;
  sourceType: SourceType;
  sourceHash: string;
  excerptHash?: string;
  scope: {
    branch?: string;
    commit?: string;
    worktreeHash?: string;
    environment?: string;
    featureFlags?: Record<string, string | boolean>;
  };
  observedBy: "grape" | "direct_user_confirmation" | "agent_reported";
  observedAt: string;
}

export interface InMemoryCompressionArtifactShape {
  compressionId: string;
  type: Extract<CompressionArtifactType, "symbol_outline" | "rule_digest" | "context_pack_summary">;
  method: CompressionMethod;
  inputRefs: string[];
  inputHashes: string[];
  policyHash: string;
  scopeHash: string;
  outputHash: string;
  createdAt: string;
  invalidatedAt?: string;
  invalidationReason?: string;
}
