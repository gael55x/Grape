# V1 Examples

This folder will contain example context artifacts, MCP responses, CLI outputs, diff packs, restore responses, and invalidation warnings.

## Required Metadata

Each example should state:

- scenario
- fixture source
- expected state
- expected warnings
- related tests

## Agent Rule

Agents must update examples when serialized output contracts change.

## Required Example Files

| File | Scenario | Must show |
|---|---|---|
| `context-artifact-basic.json` | clean TypeScript app artifact | `ContextArtifact`, sections, dependency manifest, artifact hash |
| `mcp-get-context-basic.json` | first `grape_get_context` response | structured `contextPackItems` plus rendered Markdown |
| `context-diff-unchanged.json` | second turn no-change request | `OMIT_UNCHANGED`, `PINNED`, restore tokens |
| `context-diff-invalidated.json` | source hash changes after send | `INVALIDATE_PREVIOUS` with previous item IDs |
| `unsafe-compile-secret.json` | secret scan blocks artifact | `unsafe_compile`, blocked reason, no raw secret |
| `partial-with-risk-dynamic-imports.json` | partial graph fixture | blind spots and missing-context warnings |
| `cli-status.txt` | `grape status` human output | repo state, session state, stale counts |
| `cli-status.json` | `grape status --json` output | machine schema matching CLI docs |

## Example Rules

- Examples must not contain raw secrets.
- JSON examples must validate against documented schemas.
- Markdown examples are renderings, not canonical contracts.
- Any serialized field rename updates examples, golden tests, and `SPEC_CHANGELOG.md`.
