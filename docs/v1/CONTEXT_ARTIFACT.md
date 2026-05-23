# V1 Context Artifact

## Purpose

Define the central product object produced by Grape V1.

## Required Contents

- artifact schema
- context section schema
- dependency manifest rules
- JSON and Markdown output rules
- secret scan requirements
- golden example references

## Readers

Compiler, MCP, CLI, diff, storage, and test implementers.

## Update Triggers

- artifact field changes
- section type changes
- dependency manifest changes
- serialized output changes

## Agent Checks

Before editing artifact behavior, agents must verify:

- every artifact has a dependency manifest
- every section has input refs and content hash
- high-risk required context is exact, not summary-only
- artifact output passes secret scan before storage or return

## Minimum Artifact Rule

A context artifact is invalid unless it is:

- task-specific
- branch/worktree-aware
- proof-backed where claims are durable
- dependency-tracked
- diffable
- inspectable
- invalidatable
- redaction-scanned
