export function commandForPlatform(command, platform = process.platform) {
  return platform === "win32" ? `${command}.cmd` : command;
}

export function installedBinForPlatform(binPath, platform = process.platform) {
  return platform === "win32" ? `${binPath}.cmd` : binPath;
}

export function spawnOptionsForPlatform(options = {}, platform = process.platform) {
  return platform === "win32" ? { ...options, shell: true } : options;
}

export function spawnFailureMessage(result, fallback = "command failed") {
  return cleanOutput(result.stderr) || cleanOutput(result.stdout) || result.error?.message || fallback;
}

function cleanOutput(value) {
  if (Buffer.isBuffer(value)) return value.toString("utf8").trim();
  if (typeof value === "string") return value.trim();
  return "";
}
