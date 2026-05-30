import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** True when Node loaded `entryModuleUrl` as the process entry (direct path or npm bin symlink). */
export function isCliEntrypoint(entryModuleUrl: string): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;

  const modulePath = fileURLToPath(entryModuleUrl);
  const invokedPath = path.resolve(invoked);
  try {
    return realpathSync(modulePath) === realpathSync(invokedPath);
  } catch {
    return modulePath === invokedPath;
  }
}
