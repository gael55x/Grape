import { readLocalProjectStatus } from "../app/local-project/index.js";
import type { LocalProjectStatus } from "../app/local-project/index.js";

export function runGrapeGetStatusTool(rootPath: string): LocalProjectStatus {
  return readLocalProjectStatus(rootPath);
}
