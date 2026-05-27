import type {
  ContextArtifactShape,
  ContextPackItemShape,
  InMemoryContextArtifactShape
} from "../../../shared/index.js";
import type { ContextPackBudgetResult } from "../pack/context-budget.js";

export interface RepositoryContextRenderTokenMetric {
  readonly naiveTokens: number;
  readonly grapeTokens: number;
  readonly reductionPercent: number;
}

export interface RepositoryContextRenderInput {
  readonly artifact: InMemoryContextArtifactShape;
  readonly contextArtifact: ContextArtifactShape;
  readonly contextPackItems: readonly ContextPackItemShape[];
  readonly omittedItems: readonly { readonly sectionId: string; readonly restoreId?: string }[];
  readonly tokenMetric: RepositoryContextRenderTokenMetric;
  readonly budget?: ContextPackBudgetResult;
}
