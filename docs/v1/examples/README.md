# V1 Examples

This folder contains example context artifacts, MCP responses, CLI outputs, diff packs, restore responses, and invalidation warnings.

## Required Metadata

Each example should state:

- scenario
- fixture source
- expected state
- expected warnings
- related tests

## Agent Rule

Agents must update examples when serialized output contracts change.

## Example Files

| File | Status | Scenario | Must show |
|---|---|---|---|
| `context-artifact-basic.json` | present | clean TypeScript app artifact | `ContextArtifact`, sections, dependency manifest, artifact hash |
| `mcp-get-context-basic.json` | present | first `grape_get_context` response | `agent_pack`, structured `contextPackItems`, `artifactRef`, `diffSummary`, `artifactFiles` |
| `context-diff-unchanged.json` | present | second turn no-change request | `OMIT_UNCHANGED`, `PINNED`, `RESTORE_AVAILABLE` |
| `context-diff-invalidated.json` | present | dependency manifest changes after send | `INVALIDATE_PREVIOUS` with `invalidatesSentItemId` |
| `unsafe-compile-secret.json` | present | secret scan blocks artifact | unsafe exit metadata, no raw secret |
| `partial-with-risk-dynamic-imports.json` | not yet | partial graph fixture | blind spots and missing-context warnings |
| `polyglot-fallback-context.json` | not yet | common-language fallback fixture | safe exact/path/lexical context, provider capability warnings, no false graph claims |
| `cli-status.txt` | not yet | `grape status` human output | repo state, session state, stale counts |
| `cli-status.json` | not yet | `grape status --json` output | machine schema matching CLI docs |

## Example Rules

- Examples must not contain raw secrets.
- JSON examples must validate against documented schemas.
- Markdown examples are renderings, not canonical contracts.
- Placeholder hashes and IDs are illustrative; derive new examples from behavior tests rather than inventing fields.
- Any serialized field rename updates examples, golden tests, and `../planning/spec-changelog.md`.
