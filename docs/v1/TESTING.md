# V1 Testing

## Purpose

Define required test categories and fixture rules before implementation starts.

## Required Contents

- unit test rules
- integration test rules
- state transition tests
- migration tests
- trust safety tests
- compression safety tests
- artifact golden tests
- MCP contract tests
- CLI snapshot tests
- fixture repository rules

## Readers

All implementers and reviewers.

## Update Triggers

- new behavior class
- new fixture type
- new invariant
- new benchmark

## Agent Checks

Before editing code, agents must identify the required test category for the change.

## Required Fixture Repositories

- `clean-typescript-app`
- `dirty-worktree-repo`
- `branch-switch-repo`
- `stale-proof-repo`
- `ignored-files-secrets-repo`
- `no-tests-repo`
- `dynamic-imports-repo`
- `monorepo-lite-repo`
- `auth-security-fixture`
- `compression-invalidation-fixture`
- `session-reset-fixture`
- `parallel-agents-fixture`
