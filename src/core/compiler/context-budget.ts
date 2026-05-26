import type { ContextPackItemShape } from "../../shared/index.js";

export type ContextBudgetStatus =
  | "not_requested"
  | "within_budget"
  | "over_budget"
  | "required_context_exceeds_budget";

export interface ContextPackBudgetInput {
  readonly tokenBudget?: number;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly estimatedPackTokens?: number;
}

export interface ContextPackBudgetResult {
  readonly status: ContextBudgetStatus;
  readonly tokenBudget?: number;
  readonly estimatedPackTokens: number;
  readonly requiredContextTokens: number;
  readonly warnings: readonly string[];
  readonly unsafeReasons: readonly string[];
}

export function evaluateContextPackBudget(input: ContextPackBudgetInput): ContextPackBudgetResult {
  const estimatedPackTokens = input.estimatedPackTokens ?? sumItemTokens(input.contextPackItems);
  const requiredContextTokens = sumItemTokens(input.contextPackItems.filter(isRequiredContext));

  if (input.tokenBudget === undefined) {
    return {
      status: "not_requested",
      estimatedPackTokens,
      requiredContextTokens,
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
      warnings: ["token_budget_exceeded_without_pruning"],
      unsafeReasons: []
    };
  }

  return {
    status: "within_budget",
    tokenBudget: input.tokenBudget,
    estimatedPackTokens,
    requiredContextTokens,
    warnings: [],
    unsafeReasons: []
  };
}

function isRequiredContext(item: ContextPackItemShape): boolean {
  return item.pinned || item.safetyCritical || item.state === "INVALIDATE_PREVIOUS";
}

function sumItemTokens(items: readonly ContextPackItemShape[]): number {
  return items.reduce((total, item) => total + item.tokenCount, 0);
}
