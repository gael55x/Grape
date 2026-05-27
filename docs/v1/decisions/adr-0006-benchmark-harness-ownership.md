# ADR-0006: Benchmark Harness Ownership

## Status

Accepted.

## Context

The V1 spec requires benchmark claims to use named fixtures and scripted baselines. Grape also needs CLI-first benchmark inspection, but benchmark orchestration can easily become misplaced in CLI glue or core compiler policy if the ownership boundary is not explicit.

Benchmarks need controlled side effects: copy a fixture, create a temporary Git repository, run the real local compile/diff path, and report token and safety counters. That is application workflow orchestration, not a compiler concern and not a CLI rendering concern.

## Decision

Own benchmark orchestration under `src/app/benchmark/`.

The CLI command `grape bench --fixture <name>` must stay thin: parse options, call the app benchmark service, render human or JSON output, and map pass/fail to exit codes. The benchmark app service may prepare temporary fixture repositories and call local-project compile services, but it must not promote claims, bypass compiler policy, or define ad hoc baselines.

## Consequences

Fixture benchmark behavior is testable without coupling it to the CLI entrypoint. Future benchmarks can share fixture preparation and result shaping while keeping threshold and safety checks explicit.

The first benchmark remains narrow: `bench_token_reduction_after_first_turn` over a copied fixture repo. Broader gold-label, stale-proof, current-valid, compression-invalidation, and concurrency benchmarks can be added later under the same app-owned boundary.

## Alternatives

- Put benchmark behavior directly in `src/cli/commands/bench.ts`. Rejected because it would make CLI own filesystem/Git workflow and benchmark policy.
- Put benchmark behavior in `src/core/compiler/`. Rejected because benchmarks observe compiler behavior; they should not become compiler policy.
- Add only an npm script. Rejected because the V1 spec calls for CLI-first debugging and benchmark inspection.

## Supersedes

None.

## Related Spec Sections

- `docs/v1/SPEC.md` section 6.1: benchmark harness is in V1 scope.
- `docs/v1/SPEC.md` section 15: CLI/MCP surfaces consume compiled context artifacts.
- `docs/v1/quality/benchmarks.md`: benchmark rules, thresholds, and fixture requirements.
- `docs/v1/interfaces/cli.md`: `grape bench` command contract.
- `docs/v1/architecture/overview.md`: app and CLI ownership boundaries.
