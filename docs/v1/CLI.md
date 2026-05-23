# V1 CLI

## Purpose

Define CLI command contracts for setup, inspection, debugging, and fallback workflows.

## Required Contents

- command list
- output format expectations
- exit code rules
- privacy/debug commands
- snapshot test requirements

## Readers

CLI implementers, users, and AI agents debugging local state.

## Update Triggers

- CLI command changes
- output shape changes
- setup flow changes
- diagnostic behavior changes

## Agent Checks

Before editing CLI behavior, agents must verify:

- CLI does not own business logic
- CLI calls app services
- new commands have docs and snapshot tests
- privacy-sensitive output is redacted

## Required Command Groups

- everyday: `grape help`, `grape status`, `grape doctor`
- setup/MCP: `grape init --connect`, `grape mcp`, `grape mcp --print-config`, `grape mcp --stdio`
- fallback: `grape sync`, `grape compile`, `grape diff-context`
- inspection: `grape sessions`, `grape artifacts`, `grape claims --active`, `grape stale`, `grape conflicts`, `grape omitted`
- privacy: `grape doctor --privacy`, `grape export`, `grape purge`
