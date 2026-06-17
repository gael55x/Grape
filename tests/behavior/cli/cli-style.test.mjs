import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  shouldUseColor,
  styleHumanOutput
} from "../../../.tmp/build/src/cli/style.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");
const ansiPattern = /\u001b\[[0-9;]*m|\u001b\[38;2;\d+;\d+;\d+m/;

function runCli(args, env = {}) {
  const childEnv = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete childEnv[key];
    } else {
      childEnv[key] = value;
    }
  }
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: childEnv
  });
}

test("styleHumanOutput applies Grape colors when color is enabled", () => {
  const styled = styleHumanOutput("Grape initialized.\nUsage:\n  grape mcp --install --client cursor", {
    color: true,
    stream: "stdout"
  });

  assert.match(styled, ansiPattern);
  assert.match(styled, /\u001b\[38;2;139;44;246m/);
  assert.match(styled, /\u001b\[38;2;63;221;38m/);
});

test("styleHumanOutput returns plain text when color is disabled", () => {
  const plain = "Grape initialized.\nUsage:\n  grape mcp --install --client cursor";

  assert.equal(styleHumanOutput(plain, { color: false, stream: "stdout" }), plain);
});

test("NO_COLOR disables CLI colors even when FORCE_COLOR is set", () => {
  assert.equal(
    shouldUseColor({ isTTY: true }, { FORCE_COLOR: "1", NO_COLOR: "1" }),
    false
  );

  const help = runCli(["help"], { FORCE_COLOR: "1", NO_COLOR: "1" });
  assert.equal(help.status, 0, help.stderr);
  assert.doesNotMatch(help.stdout, ansiPattern);
});

test("FORCE_COLOR styles human help without coloring JSON output", () => {
  const help = runCli(["help"], { FORCE_COLOR: "1", NO_COLOR: undefined });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, ansiPattern);

  const config = runCli(["mcp", "--print-config"], { FORCE_COLOR: "1", NO_COLOR: undefined });
  assert.equal(config.status, 0, config.stderr);
  assert.doesNotMatch(config.stdout, ansiPattern);
  assert.equal(JSON.parse(config.stdout).grapeMcp.status, "implemented");
});
