# Dirty Worktree TypeScript Fixture

This fixture measures what Grape does after an agent has already seen context and then a tracked source file changes without a commit.

The benchmark edits `src/calculateDiscount.ts` in the prepared workspace, leaves the change uncommitted, and expects Grape to invalidate earlier context instead of treating it as reusable.
