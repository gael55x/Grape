import { readPublicLocalProjectStatus } from "../app/local-project/index.js";
import type { PublicLocalProjectStatus } from "../app/local-project/index.js";

export type GrapeGetStatusOutput = Omit<
  PublicLocalProjectStatus,
  "rootPath" | "grapeDirPath" | "configPath" | "databasePath"
>;

export function runGrapeGetStatusTool(rootPath: string): GrapeGetStatusOutput {
  const status = readPublicLocalProjectStatus(rootPath);
  const {
    rootPath: _rootPath,
    grapeDirPath: _grapeDirPath,
    configPath: _configPath,
    databasePath: _databasePath,
    ...safeStatus
  } = status;
  return safeStatus;
}
