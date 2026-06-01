export function defaultProjectId(repoId: string): string {
  return `project:${repoId.replace(/^repo:/, "")}`;
}
