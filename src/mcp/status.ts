import { readLocalProjectStatus } from "../app/local-project/index.js";
import type { LocalProjectStatus } from "../app/local-project/index.js";

export type GrapeGetStatusOutput = Omit<
  LocalProjectStatus,
  "rootPath" | "grapeDirPath" | "configPath" | "databasePath"
>;

export function runGrapeGetStatusTool(rootPath: string): GrapeGetStatusOutput {
  const status = readLocalProjectStatus(rootPath);
  const {
    rootPath: _rootPath,
    grapeDirPath: _grapeDirPath,
    configPath: _configPath,
    databasePath: _databasePath,
    ...safeStatus
  } = status;
  return safeStatus;
}
