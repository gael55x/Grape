import type { ContextPackItemShape } from "../../../shared/index.js";

export type ContextBudgetStatus =
  | "not_requested"
  | "within_budget"
  | "over_budget"
  | "required_context_exceeds_budget";

export interface ContextPackBudgetInput {
  readonly tokenBudget?: number;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly estimatedPackTokens?: number;
  readonly omittedDueToBudget?: readonly ContextBudgetOmittedItem[];
}

export interface ContextBudgetOmittedItem {
  readonly id: string;
  readonly itemKind: ContextPackItemShape["itemKind"];
  readonly itemRef: string;
  readonly itemHash: string;
  readonly sectionId?: string;
  readonly tokenCount: number;
  readonly canRestore: boolean;
  readonly restoreId?: string;
}

export interface ContextPackBudgetResult {
  readonly status: ContextBudgetStatus;
  readonly tokenBudget?: number;
  readonly estimatedPackTokens: number;
  readonly requiredContextTokens: number;
  readonly omittedDueToBudget: readonly ContextBudgetOmittedItem[];
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
}

export function evaluateContextPackBudget(input: ContextPackBudgetInput): ContextPackBudgetResult {
  const estimatedPackTokens = input.estimatedPackTokens ?? sumItemTokens(input.contextPackItems);
  const requiredContextTokens = sumItemTokens(input.contextPackItems.filter(isRequiredContext));
  const omittedDueToBudget = input.omittedDueToBudget ?? [];

  if (input.tokenBudget === undefined) {
    return {
      status: "not_requested",
      estimatedPackTokens,
      requiredContextTokens,
      omittedDueToBudget,
      warnings: [],
      unsafeReasons: []
    };
  }

  if (requiredContextTokens > input.tokenBudget) {
    return {
      status: "required_context_exceeds_budget",
      tokenBudget: input.tokenBudget,
      estimatedPackTokens,
      requiredContextTokens,
      omittedDueToBudget,
      warnings: [],
      unsafeReasons: ["token_budget_below_required_context"]
    };
  }

  if (estimatedPackTokens > input.tokenBudget) {
    return {
      status: "over_budget",
      tokenBudget: input.tokenBudget,
      estimatedPackTokens,
      requiredContextTokens,
      omittedDueToBudget,
      warnings: ["token_budget_exceeded_without_pruning"],
      unsafeReasons: []
    };
  }

  return {
    status: "within_budget",
    tokenBudget: input.tokenBudget,
    estimatedPackTokens,
    requiredContextTokens,
    omittedDueToBudget,
    warnings: omittedDueToBudget.length > 0 ? ["token_budget_pruned_optional_context"] : [],
    unsafeReasons: []
  };
}

function isRequiredContext(item: ContextPackItemShape): boolean {
  return item.pinned || item.safetyCritical || item.state === "INVALIDATE_PREVIOUS";
}

function sumItemTokens(items: readonly ContextPackItemShape[]): number {
  return items.reduce((total, item) => total + item.tokenCount, 0);
}
