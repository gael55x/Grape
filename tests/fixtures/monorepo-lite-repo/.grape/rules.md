# Fixture Rules

- Prefer package-local source and tests when the task names a nested package path.
- Do not allow unrelated workspace packages to exhaust task-specific context.
- Treat package-boundary inference as partial unless a manifest or exact source ref proves it.
