import { commandForPlatform, spawnOptionsForPlatform } from "./platform-command.mjs";

assert(commandForPlatform("git", "win32") === "git", "Windows Git must use git, not git.cmd");
assert(commandForPlatform("npm", "win32") === "npm.cmd", "Windows npm must use npm.cmd");
assert(commandForPlatform("codex", "win32") === "codex.cmd", "Windows Codex shim must use codex.cmd");
assert(commandForPlatform("git", "darwin") === "git", "macOS Git must use git");
assert(commandForPlatform("npm", "linux") === "npm", "Linux npm must use npm");

const windowsOptions = spawnOptionsForPlatform({ cwd: "." }, "win32");
assert(windowsOptions.shell === true, "Windows command spawns must default to shell mode");

const explicitShellOptions = spawnOptionsForPlatform({ shell: false }, "win32");
assert(explicitShellOptions.shell === false, "Explicit shell setting must be preserved");

const linuxOptions = spawnOptionsForPlatform({ cwd: "." }, "linux");
assert(linuxOptions.shell === undefined, "Non-Windows command spawns must not force shell mode");

console.log("platform command helpers ok");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
