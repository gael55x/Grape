import path from "node:path";

import type { LocalProjectConfig, LocalProjectLayout } from "./config.js";
import { ensureLocalProjectLayout, readLocalProjectConfig } from "./config.js";

export interface ConfiguredLocalProjectLayout {
  readonly layout: LocalProjectLayout;
  readonly config: LocalProjectConfig;
}

export function ensureConfiguredLocalProjectLayout(rootPath: string): ConfiguredLocalProjectLayout {
  const layout = ensureLocalProjectLayout(rootPath);
  const config = readLocalProjectConfig(layout.configPath);
  if (!config) throw new Error("Grape config is missing. Run grape init --connect.");
  if (path.resolve(config.project.rootPath) !== layout.rootPath) {
    throw new Error("Grape config root path does not match the current repository path.");
  }
  return { layout, config };
}
