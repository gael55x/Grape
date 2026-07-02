export function listMcpTools(): { readonly tools: readonly unknown[] } {
  return {
    tools: [
      {
        name: "grape_get_context",
        description:
          "Get compact, current repo context for one coding task and session.",
        inputSchema: {
          type: "object",
          required: ["query"],
          anyOf: [{ required: ["sessionId"] }, { required: ["agentSessionId"] }],
          additionalProperties: false,
          properties: {
            query: {
              type: "string",
              minLength: 1,
              description: "Current coding task or question."
            },
            taskType: {
              type: "string",
              enum: ["bug_fix", "security_fix", "refactor", "migration", "feature", "test_repair", "analysis"]
            },
            files: { type: "array", items: { type: "string", minLength: 1 } },
            symbols: { type: "array", items: { type: "string", minLength: 1 } },
            tests: { type: "array", items: { type: "string", minLength: 1 } },
            environmentScope: {
              type: "string",
              enum: ["local", "test", "ci", "staging", "production", "unknown"]
            },
            featureFlags: {
              type: "object",
              additionalProperties: {
                anyOf: [
                  { type: "boolean" },
                  { type: "string", minLength: 1 }
                ]
              }
            },
            tokenBudget: { type: "integer", minimum: 1 },
            sessionId: { type: "string", minLength: 1 },
            agentName: { type: "string", minLength: 1 },
            agentSessionId: { type: "string", minLength: 1 },
            resetSession: {
              type: "boolean",
              description: "Force full resend for this session because the agent lost prior context."
            },
            outputMode: {
              type: "string",
              enum: ["agent_pack", "full"],
              description:
                "agent_pack returns compact context; full also embeds the full artifact and item bodies."
            }
          }
        }
      },
      readTool("grape_get_artifact", "Inspect artifact metadata; use full only when exact stored JSON is needed.", {
        artifactId: { type: "string", minLength: 1 },
        outputMode: {
          type: "string",
          enum: ["metadata", "full"],
          description: "metadata returns refs/dependencies only; full also returns the stored public artifact JSON."
        }
      }, ["artifactId"]),
      readTool("grape_get_claims", "Inspect current-valid claims without raw source bodies.", {
        activeOnly: { type: "boolean" }
      }),
      readTool("grape_get_proofs", "Inspect exact-source proof metadata without raw excerpts.", {
        proofId: { type: "string", minLength: 1 },
        sourceId: { type: "string", minLength: 1 }
      }),
      readTool("grape_get_rules", "Inspect current Git-visible project rule excerpts after safety checks.", {}),
      readTool("grape_get_omitted_item", "Restore an omitted context item after dependency checks.", {
        sessionId: { type: "string", minLength: 1 },
        restoreToken: { type: "string", minLength: 1 }
      }, ["sessionId", "restoreToken"]),
      readTool("grape_get_stale_items", "List prior context Grape marked stale without returning bodies.", {
        sessionId: { type: "string", minLength: 1 }
      }),
      readTool("grape_get_conflicts", "Inspect recorded claim conflicts without resolving them.", {}),
      readTool(
        "grape_get_status",
        "Check Grape setup, repository state, and recovery guidance.",
        {}
      ),
      {
        name: "grape_record_candidate",
        description: "Record an agent claim candidate as non-durable evidence.",
        inputSchema: {
          type: "object",
          required: ["sessionId", "subject", "claimType", "claimText", "scope", "reportedBy"],
          additionalProperties: false,
          properties: {
            sessionId: { type: "string", minLength: 1 },
            subject: { type: "string", minLength: 1 },
            claimType: { type: "string", minLength: 1 },
            claimText: { type: "string", minLength: 1 },
            scope: { type: "object" },
            sourceId: { type: "string", minLength: 1 },
            reportedBy: { type: "string", enum: ["agent"] }
          }
        }
      },
      {
        name: "grape_record_command_result",
        description: "Record agent-reported command metadata as temporary evidence.",
        inputSchema: {
          type: "object",
          required: [
            "sessionId",
            "command",
            "commandHash",
            "cwd",
            "exitCode",
            "stdoutHash",
            "stderrHash",
            "startedAt",
            "endedAt"
          ],
          additionalProperties: false,
          properties: observationProperties()
        }
      },
      {
        name: "grape_record_test_result",
        description: "Record agent-reported test metadata as temporary evidence.",
        inputSchema: {
          type: "object",
          required: [
            "sessionId",
            "command",
            "commandHash",
            "cwd",
            "exitCode",
            "stdoutHash",
            "stderrHash",
            "startedAt",
            "endedAt",
            "passed"
          ],
          additionalProperties: false,
          properties: {
            ...observationProperties(),
            passed: { type: "boolean" },
            testFramework: { type: "string", minLength: 1 },
            testFiles: { type: "array", items: { type: "string", minLength: 1 } }
          }
        }
      },
      {
        name: "grape_record_user_decision",
        description: "Record a directly confirmed user decision as temporary redacted evidence.",
        inputSchema: {
          type: "object",
          required: [
            "sessionId",
            "prompt",
            "promptHash",
            "response",
            "responseHash",
            "confirmationChannel",
            "confirmedByUser",
            "confirmedAt",
            "scope",
            "reportedBy"
          ],
          additionalProperties: false,
          properties: {
            sessionId: { type: "string", minLength: 1 },
            prompt: {
              type: "string",
              minLength: 1,
              description: "Raw prompt used only to verify promptHash; it is not persisted or returned."
            },
            promptHash: sha256Schema(),
            response: {
              type: "string",
              minLength: 1,
              description: "Raw response used only to verify responseHash; it is not persisted or returned."
            },
            responseHash: sha256Schema(),
            confirmationChannel: {
              type: "string",
              enum: ["cli_prompt", "mcp_user_confirmation", "config_file", "rule_file"]
            },
            confirmedByUser: { type: "boolean" },
            confirmedAt: { type: "string", minLength: 1 },
            scope: { type: "object" },
            reportedBy: { type: "string", enum: ["agent"] }
          }
        }
      },
      {
        name: "grape_request_user_confirmation",
        description: "Create a non-durable request ID for direct user confirmation.",
        inputSchema: {
          type: "object",
          required: ["sessionId", "prompt", "promptHash", "scope", "reportedBy"],
          additionalProperties: false,
          properties: {
            sessionId: { type: "string", minLength: 1 },
            prompt: {
              type: "string",
              minLength: 1,
              description: "Raw prompt used only to verify promptHash; it is not persisted or returned."
            },
            promptHash: sha256Schema(),
            scope: { type: "object" },
            reason: { type: "string", minLength: 1 },
            reportedBy: { type: "string", enum: ["agent"] }
          }
        }
      }
    ]
  };
}

function readTool(name: string, description: string, properties: Record<string, unknown>, required: string[] = []) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      required,
      additionalProperties: false,
      properties
    }
  };
}

function observationProperties(): Record<string, unknown> {
  return {
    sessionId: { type: "string", minLength: 1 },
    command: {
      type: "string",
      minLength: 1,
      description: "Raw command used only to verify commandHash; it is not persisted."
    },
    commandHash: sha256Schema(),
    cwd: { type: "string", minLength: 1 },
    exitCode: { type: "integer" },
    stdoutHash: sha256Schema(),
    stderrHash: sha256Schema(),
    startedAt: { type: "string", minLength: 1 },
    endedAt: { type: "string", minLength: 1 },
    reportedBy: { type: "string", enum: ["agent"] }
  };
}

function sha256Schema(): Record<string, unknown> {
  return { type: "string", pattern: "^[A-Fa-f0-9]{64}$" };
}
