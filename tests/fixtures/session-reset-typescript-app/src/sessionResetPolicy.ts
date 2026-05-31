export interface AgentContextState {
  readonly sessionId: string;
  readonly taskKey: string;
  readonly agentLostContext: boolean;
  readonly repoStateHash: string;
  readonly pinnedSafetyVersion: string;
}

export interface SessionResetPlan {
  readonly resetSession: boolean;
  readonly invalidatesPriorContext: boolean;
  readonly resendPinnedSafety: boolean;
  readonly restoreOmissions: boolean;
  readonly reason: "agent_lost_context" | "continue_existing_context";
}

export function planSessionReset(state: AgentContextState): SessionResetPlan {
  if (state.agentLostContext) {
    return {
      resetSession: true,
      invalidatesPriorContext: true,
      resendPinnedSafety: true,
      restoreOmissions: false,
      reason: "agent_lost_context"
    };
  }

  return {
    resetSession: false,
    invalidatesPriorContext: false,
    resendPinnedSafety: true,
    restoreOmissions: true,
    reason: "continue_existing_context"
  };
}
