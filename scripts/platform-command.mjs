import path from "node:path";

export function commandForPlatform(command, platform = process.platform) {
  if (platform === "win32" && command === "git") {
    return "git";
  }
  return platform === "win32" ? `${command}.cmd` : command;
}

export function installedPackageBinTarget(installRoot, packageName, binTarget) {
  return path.join(installRoot, "node_modules", ...packageName.split("/"), binTarget);
}

export function spawnOptionsForPlatform(options = {}, platform = process.platform) {
  return platform === "win32" && options.shell === undefined ? { ...options, shell: true } : options;
}

export function spawnFailureMessage(result, fallback = "command failed") {
  return cleanOutput(result.stderr) || cleanOutput(result.stdout) || result.error?.message || fallback;
}

function cleanOutput(value) {
  if (Buffer.isBuffer(value)) return value.toString("utf8").trim();
  if (typeof value === "string") return value.trim();
  return "";
}
