# ADR-0008: Agent Artifact Annotations

## Status

Accepted.

## Context

Grape's V1 product boundary is the compiled Context Artifact and Context Diff for a task, branch, session, and dependency state. The V1 spec also includes restricted MCP write tools so agents can record command results, test results, candidate claims, and direct user-decision metadata.

Agent-authored artifact annotations are tempting because they could let an agent attach notes such as "I already checked this file" or "this failure matters" directly to an artifact. Implemented too early, that would blur Grape's trust boundary and make the artifact look like a memory record or agent notebook. It would also risk treating model-authored interpretation as current-valid context without proof, scope, invalidation, or direct user confirmation.

The comparison with memory-oriented systems, including PCKC/chum-mem-style projects, reinforces the distinction. Those systems primarily manage trustworthy memory. Grape should use proof and memory primitives where they serve compilation, but V1 should remain artifact-first: compile the evidence-backed context an agent should consume now.

## Decision

V1 does not add agent-authored annotations to rendered `ContextArtifact` output sections or context-pack bodies.

Agents may continue to use the restricted MCP write tools as the safe V1 foundation:

- `grape_record_command_result`
- `grape_record_test_result`
- `grape_record_candidate`
- `grape_record_user_decision`
- `grape_request_user_confirmation`

Those tools record temporary evidence, candidates, hashes, and confirmation request metadata. They do not mutate an existing artifact into durable truth, do not satisfy proof requirements, and do not become current-valid context unless a later Trust Kernel flow validates proof and scope.

If V1.1 adds artifact annotations, they must be a separate non-authoritative overlay with explicit source type, observed-by value, scope, dependency refs, hashes, redaction status, lifecycle, and rendering rules. They must not be stored inside output sections in a way that can be mistaken for proof-backed context.

## Consequences

Grape stays simple to explain: it compiles a verifiable context artifact instead of becoming a general memory store or annotation notebook.

The V1 MCP surface remains useful for agents that need to report observations while preserving the rule that MCP writes cannot directly promote durable truth.

Some agent workflow notes will not appear in the artifact body in V1. Agents should rely on context diffs, recovery guidance, restricted write tool IDs, and future inspected evidence surfaces instead of expecting free-form artifact annotations.

Future annotation work must start by defining the trust boundary, schema, rendering policy, tests, and invalidation behavior before any implementation.

## Alternatives

- Render agent notes directly into `ContextArtifact.outputSections`. Rejected because agent text could be confused with proof-backed context and would weaken the artifact's trust boundary.
- Store agent annotations as durable claims immediately. Rejected because model-authored notes are not proof and must pass the same proof, scope, and belief gates as any other durable truth.
- Add a generic annotation plugin surface in V1. Rejected as speculative scope expansion and a setup/DX risk.
- Keep no agent write path at all. Rejected because restricted non-promoting write tools are useful for coding-agent workflows when they remain clearly outside durable truth.

## Supersedes

None.

## Related Spec Sections

- `docs/v1/SPEC.md` section 2.7: chum-mem / PCKC-style memory comparison.
- `docs/v1/SPEC.md` section 4.4: Context Artifact as the product object.
- `docs/v1/SPEC.md` section 5.2: Grape V1 is not a cloud memory platform or chatbot.
- `docs/v1/SPEC.md` section 28.1: agents can request context and record evidence but cannot directly promote durable truth.
- `docs/v1/interfaces/mcp-tools.md`: restricted MCP write tools.
- `docs/v1/core/trust-model.md`: MCP writes cannot promote directly.
