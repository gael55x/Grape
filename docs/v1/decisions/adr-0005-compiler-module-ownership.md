# ADR-0005: Compiler Module Ownership

## Status

Accepted.

## Context

`src/core/compiler/` grew into several distinct responsibilities: scaffold artifact guards, public V1 projection, context-pack budget mapping, repository-derived artifact compilation, section construction, dependency manifests, integrity hashes, source proof refs, and risk policy. Keeping all compiler files flat made navigation harder and encouraged future contributors to add new compiler behavior without first choosing a clear owner.

The V1 architecture requires small modules with explicit responsibilities and stable public interfaces. The compiler also sits on a trust boundary: it may render proof-backed context, but it must not validate proofs, promote claims, or write storage SQL.

## Decision

Split `src/core/compiler/` into ownership subdirectories:

- `artifact/` owns artifact shape guards and public artifact projection code.
- `pack/` owns context-pack item mapping and token-budget evaluation.
- `repository/` owns repository-derived context artifact compilation.
- `repository/manifest/` owns dependency manifest construction and dependency ID helpers.
- `repository/proofs/` owns compiler-local proof-ref helpers. It does not validate proofs or promote claims.
- `repository/validation/` owns artifact, section, and manifest integrity checks.
- `repository/selection/` owns bounded source, excerpt, symbol, and relationship selection.
- `repository/sections/` owns section assembly and section-local dependency helpers for repository-derived artifacts.
- `repository/sections/builders/` owns individual section builders by output section family.
- `repository/policy/` owns compiler policy such as risk overlay evaluation.
- `repository/rendering/` owns JSON rendering and narrow render input contracts shared by JSON and Markdown renderers.
- `repository/markdown/` owns agent-facing Markdown rendering for repository-derived context packs.

Keep `src/core/compiler/index.ts` as the public export boundary for other layers. Internal imports may use focused submodule paths within the compiler package, but unrelated layers should not depend on private compiler file layout.

## Consequences

Compiler navigation now follows purpose instead of filename prefixes. Future artifact-section work has an obvious home under `repository/sections/builders/`, section dependency wiring belongs under `repository/sections/`, future dependency-manifest work belongs under `repository/manifest/`, proof-ref formatting belongs under `repository/proofs/`, selection limits and ordering belong under `repository/selection/`, artifact integrity checks belong under `repository/validation/`, compiler policy work belongs under `repository/policy/`, and rendered output contract work belongs under `repository/rendering/` or `repository/markdown/`.

The ownership boundary does not permit compiler code to change dependency hashing, trust promotion, storage access, CLI orchestration, or MCP transport behavior. Any artifact or Markdown contract change still needs the artifact contract and tests updated in the same slice.

## Alternatives

- Keep a flat compiler directory and rely on filename prefixes. Rejected because the directory was already long enough to slow review and invited prefix sprawl.
- Split by generic buckets like `utils/`, `helpers/`, or `models/`. Rejected because those names hide ownership and contradict the V1 modularity rules.
- Create separate top-level core packages for artifact, pack, and repository compilation. Rejected as unnecessary for V1 because the responsibilities are still compiler-owned.

## Supersedes

None.

## Related Spec Sections

- `docs/v1/SPEC.md` section 2.3: keep MCP/CLI as thin adapters over local services.
- `docs/v1/SPEC.md` section 9: context graph and dependency manifest requirements.
- `docs/v1/SPEC.md` section 15: MCP/CLI integration surfaces consume compiled context artifacts.
- `docs/v1/contracts/context-artifact.md`: artifact and section contract.
- `docs/v1/architecture/overview.md`: module boundaries and code modularity standards.
