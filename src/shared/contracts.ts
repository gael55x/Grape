export const taskTypes = [
  "general",
  "refactor",
  "feature",
  "bugfix",
  "test",
  "docs",
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
  "repo_file",
  "project_rule",
  "config_file",
  "test_result",
  "command_result",
  "user_confirmation",
  "agent_reported",
  "model_summarized"
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const verificationStatuses = [
  "unverified",
  "partially_verified",
  "verified",
  "stale",
  "contradicted",
  "rejected"
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];

export const scopeMatchResults = ["match", "mismatch", "partial", "unknown"] as const;

export type ScopeMatchResult = (typeof scopeMatchResults)[number];

export interface ContextInput {
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

export interface ContextSection {
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

export interface ContextDependency {
  id: string;
  kind:
    | "repo_snapshot"
    | "worktree_state"
    | "source_file"
    | "proof"
    | "claim"
    | "rule"
    | "compression_artifact"
    | "session_ledger";
  ref: string;
  hash: string;
  scope: Record<string, unknown>;
}

export interface ContextDependencyManifest {
  manifestId: string;
  dependencies: ContextDependency[];
  createdAt: string;
  hashAlgorithm: "sha256";
  manifestHash: string;
}

export interface ContextPackItem {
  itemId: string;
  artifactId: string;
  sectionId: string;
  state: DiffState;
  title: string;
  body: string;
  contentHash: string;
  previousItemId?: string;
  restoreToken?: string;
  pinned: boolean;
  warnings: string[];
}

export interface ContextArtifact {
  artifactId: string;
  input: ContextInput;
  sections: ContextSection[];
  dependencyManifest: ContextDependencyManifest;
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

export interface CompressionArtifact {
  compressionId: string;
  type: "symbol_outline" | "rule_digest" | "context_pack_ledger";
  method: "deterministic";
  inputRefs: string[];
  inputHashes: string[];
  policyHash: string;
  scopeHash: string;
  outputHash: string;
  createdAt: string;
  invalidatedAt?: string;
  invalidationReason?: string;
}
