import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  installMcpClientConfig,
  unsupportedAutoInstallMessage
} from "../../../.tmp/build/src/app/local-project/setup/mcp-client-config.js";

const cliPath = path.join(process.cwd(), ".tmp/build/src/cli/index.js");

function withTempDir(prefix, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(cwd, args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function expectedServer(rootPath) {
  const root = realpathSync(rootPath);
  return {
    command: "grape",
    args: ["mcp", "--stdio", "--repo", root],
    cwd: root
  };
}

function cursorConfigPath(rootPath) {
  return path.join(rootPath, ".cursor", "mcp.json");
}

function codexConfigPath(rootPath) {
  return path.join(rootPath, ".codex", "config.toml");
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertGrapeServer(config, rootPath) {
  assert.deepEqual(config.mcpServers.grape, expectedServer(rootPath));
}

function assertCodexGrapeServer(toml, rootPath) {
  const expected = expectedServer(rootPath);
  assert.match(toml, /\[mcp_servers\.grape\]/);
  assert.match(toml, new RegExp(`command = ${escapeRegExp(JSON.stringify(expected.command))}`));
  assert.match(toml, new RegExp(`args = ${escapeRegExp(JSON.stringify(expected.args).replace(/,/g, ", "))}`));
  assert.match(toml, new RegExp(`cwd = ${escapeRegExp(JSON.stringify(expected.cwd))}`));
}

function claudeEnvAndPath(basePath) {
  if (process.platform === "win32") {
    return {
      env: {
        APPDATA: path.join(basePath, "appdata"),
        USERPROFILE: path.join(basePath, "home")
      },
      configPath: path.join(basePath, "appdata", "Claude", "claude_desktop_config.json")
    };
  }

  if (process.platform === "linux") {
    return {
      env: {
        HOME: path.join(basePath, "home"),
        XDG_CONFIG_HOME: path.join(basePath, "xdg")
      },
      configPath: path.join(basePath, "xdg", "Claude", "claude_desktop_config.json")
    };
  }

  return {
    env: {
      HOME: path.join(basePath, "home")
    },
    configPath: path.join(basePath, "home", "Library", "Application Support", "Claude", "claude_desktop_config.json")
  };
}

test("cli help exposes MCP client install flags", () => {
  const help = runCli(process.cwd(), ["help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /grape mcp --install --client cursor/);
  assert.match(help.stdout, /grape mcp --install --client claude/);
  assert.match(help.stdout, /grape mcp --install --client codex/);
  assert.match(help.stdout, /grape mcp --print-agents-snippet/);
  assert.match(help.stdout, /--client <name>/);
  assert.match(help.stdout, /--dry-run/);
  assert.match(help.stdout, /--force/);

  const mcpHelp = runCli(process.cwd(), ["mcp", "--help"]);
  assert.equal(mcpHelp.status, 0, mcpHelp.stderr);
  assert.match(mcpHelp.stdout, /grape mcp --install --client cursor/);
  assert.match(mcpHelp.stdout, /grape mcp --install --client claude/);
  assert.match(mcpHelp.stdout, /grape mcp --install --client codex/);
  assert.match(mcpHelp.stdout, /grape mcp --print-agents-snippet/);
  assert.match(mcpHelp.stdout, /--dry-run prints the target path and final config/);
});

test("cli rejects unsupported MCP auto-install clients with manual fallback guidance", () => {
  withTempDir("grape-mcp-install-unsupported-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--install", "--client", "cline"]);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, new RegExp(escapeRegExp(unsupportedAutoInstallMessage)));
  });
});

test("mcp --print-agents-snippet prints path-neutral setup guidance", () => {
  withTempDir("grape-mcp-agents-snippet-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--print-agents-snippet"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /## Grape Context/);
    assert.match(result.stdout, /call `grape_get_context`/);
    assert.match(result.stdout, /stable `sessionId`/);
    assert.match(result.stdout, /`INVALIDATE_PREVIOUS`/);
    assert.match(result.stdout, /not as a full code graph replacement/);
    assert.doesNotMatch(result.stdout, new RegExp(escapeRegExp(rootPath)));
  });
});

test("mcp action flags are mutually exclusive with agents snippet output", () => {
  withTempDir("grape-mcp-agents-snippet-exclusive-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--print-config", "--print-agents-snippet"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Choose only one MCP action/);
  });
});

test("cursor MCP install dry-run prints target and final JSON without writing", () => {
  withTempDir("grape-mcp-install-cursor-dry-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--install", "--client", "cursor", "--dry-run"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Dry run: no changes written/);
    assert.match(result.stdout, /Client: Cursor/);
    assert.match(result.stdout, /Target: <repo-root>[\\/]\.cursor[\\/]mcp\.json/);
    assert.match(result.stdout, /Server command: grape mcp --stdio --repo <repo-root>/);
    assert.match(result.stdout, /Restart or reload Cursor/);
    assert.match(result.stdout, /Verify the connection by listing MCP tools or calling grape_get_status/);
    assert.match(result.stdout, /Manual fallback: grape mcp --print-config/);
    assert.match(result.stdout, /"mcpServers"/);
    assert.match(result.stdout, /"grape"/);
    assert.equal(existsSync(cursorConfigPath(rootPath)), false);
  });
});

test("cursor MCP install creates project-local config", () => {
  withTempDir("grape-mcp-install-cursor-fresh-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--install", "--client", "cursor"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Wrote Grape MCP server config for Cursor/);
    assert.match(result.stdout, /Server entry: mcpServers\.grape/);
    assert.match(result.stdout, /Ask the agent to call grape_get_context with a stable sessionId/);
    const config = readJson(cursorConfigPath(rootPath));
    assertGrapeServer(config, rootPath);
  });
});

test("cursor MCP install preserves unrelated config and merges Grape server", () => {
  withTempDir("grape-mcp-install-cursor-merge-", (rootPath) => {
    const targetPath = cursorConfigPath(rootPath);
    writeJson(targetPath, {
      custom: true,
      mcpServers: {
        other: {
          command: "other",
          args: ["serve"]
        }
      }
    });

    const result = runCli(rootPath, ["mcp", "--install", "--client", "cursor"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Updated Grape MCP server config for Cursor/);
    const config = readJson(targetPath);
    assert.equal(config.custom, true);
    assert.deepEqual(config.mcpServers.other, { command: "other", args: ["serve"] });
    assertGrapeServer(config, rootPath);
  });
});

test("cursor MCP install reports identical config as already configured", () => {
  withTempDir("grape-mcp-install-cursor-identical-", (rootPath) => {
    const targetPath = cursorConfigPath(rootPath);
    writeJson(targetPath, {
      mcpServers: {
        grape: expectedServer(rootPath)
      }
    });

    const result = runCli(rootPath, ["mcp", "--install", "--client", "cursor"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already configured/);
    assert.deepEqual(readJson(targetPath).mcpServers.grape, expectedServer(rootPath));
  });
});

test("cursor MCP install refuses conflicting Grape entry unless forced", () => {
  withTempDir("grape-mcp-install-cursor-conflict-", (rootPath) => {
    const targetPath = cursorConfigPath(rootPath);
    const existing = {
      mcpServers: {
        other: { command: "other" },
        grape: { command: "old-grape", args: [] }
      }
    };
    writeJson(targetPath, existing);

    const refused = runCli(rootPath, ["mcp", "--install", "--client", "cursor"]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /differs from the current config/);
    assert.deepEqual(readJson(targetPath), existing);

    const forced = runCli(rootPath, ["mcp", "--install", "--client", "cursor", "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(forced.stdout, /Updated Grape MCP server config for Cursor/);
    const config = readJson(targetPath);
    assert.deepEqual(config.mcpServers.other, { command: "other" });
    assertGrapeServer(config, rootPath);
  });
});

test("cursor MCP install fails safely on invalid JSON without overwriting", () => {
  withTempDir("grape-mcp-install-cursor-invalid-", (rootPath) => {
    const targetPath = cursorConfigPath(rootPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const invalidJson = "{ invalid json\n";
    writeFileSync(targetPath, invalidJson);

    const result = runCli(rootPath, ["mcp", "--install", "--client", "cursor"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid JSON/);
    assert.equal(readFileSync(targetPath, "utf8"), invalidJson);
  });
});

test("claude MCP install dry-run prints target and final JSON without writing", () => {
  withTempDir("grape-mcp-install-claude-dry-", (rootPath) => {
    const { env, configPath } = claudeEnvAndPath(rootPath);
    const result = runCli(rootPath, ["mcp", "--install", "--client", "claude", "--dry-run"], env);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Dry run: no changes written/);
    assert.match(result.stdout, /Client: Claude Desktop/);
    assert.match(result.stdout, /Target:/);
    assert.match(result.stdout, /Server command: grape mcp --stdio --repo <repo-root>/);
    assert.match(result.stdout, /Restart or reload Claude Desktop/);
    assert.match(result.stdout, /Manual fallback: grape mcp --print-config/);
    assert.match(result.stdout, /"mcpServers"/);
    assert.match(result.stdout, /"grape"/);
    assert.equal(existsSync(configPath), false);
  });
});

test("claude MCP install creates resolved Claude Desktop config", () => {
  withTempDir("grape-mcp-install-claude-fresh-", (rootPath) => {
    const { env, configPath } = claudeEnvAndPath(rootPath);
    const result = runCli(rootPath, ["mcp", "--install", "--client", "claude"], env);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Wrote Grape MCP server config for Claude Desktop/);
    const config = readJson(configPath);
    assertGrapeServer(config, rootPath);
  });
});

test("claude MCP install preserves unrelated config and merges Grape server", () => {
  withTempDir("grape-mcp-install-claude-merge-", (rootPath) => {
    const { env, configPath } = claudeEnvAndPath(rootPath);
    writeJson(configPath, {
      globalShortcut: "disabled",
      mcpServers: {
        docs: {
          command: "docs-server",
          args: ["serve"]
        }
      }
    });

    const result = runCli(rootPath, ["mcp", "--install", "--client", "claude"], env);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Updated Grape MCP server config for Claude Desktop/);
    const config = readJson(configPath);
    assert.equal(config.globalShortcut, "disabled");
    assert.deepEqual(config.mcpServers.docs, { command: "docs-server", args: ["serve"] });
    assertGrapeServer(config, rootPath);
  });
});

test("claude MCP install reports identical config as already configured", () => {
  withTempDir("grape-mcp-install-claude-identical-", (rootPath) => {
    const { env, configPath } = claudeEnvAndPath(rootPath);
    writeJson(configPath, {
      mcpServers: {
        grape: expectedServer(rootPath)
      }
    });

    const result = runCli(rootPath, ["mcp", "--install", "--client", "claude"], env);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already configured/);
    assertGrapeServer(readJson(configPath), rootPath);
  });
});

test("claude MCP install refuses conflicting Grape entry unless forced", () => {
  withTempDir("grape-mcp-install-claude-conflict-", (rootPath) => {
    const { env, configPath } = claudeEnvAndPath(rootPath);
    const existing = {
      mcpServers: {
        docs: { command: "docs-server" },
        grape: { command: "old-grape", args: [] }
      }
    };
    writeJson(configPath, existing);

    const refused = runCli(rootPath, ["mcp", "--install", "--client", "claude"], env);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /differs from the current config/);
    assert.deepEqual(readJson(configPath), existing);

    const forced = runCli(rootPath, ["mcp", "--install", "--client", "claude", "--force"], env);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(forced.stdout, /Updated Grape MCP server config for Claude Desktop/);
    const config = readJson(configPath);
    assert.deepEqual(config.mcpServers.docs, { command: "docs-server" });
    assertGrapeServer(config, rootPath);
  });
});

test("claude MCP install fails safely on invalid JSON without overwriting", () => {
  withTempDir("grape-mcp-install-claude-invalid-", (rootPath) => {
    const { env, configPath } = claudeEnvAndPath(rootPath);
    mkdirSync(path.dirname(configPath), { recursive: true });
    const invalidJson = "{ invalid json\n";
    writeFileSync(configPath, invalidJson);

    const result = runCli(rootPath, ["mcp", "--install", "--client", "claude"], env);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid JSON/);
    assert.equal(readFileSync(configPath, "utf8"), invalidJson);
  });
});

test("claude MCP install fails safely when config path is uncertain", () => {
  withTempDir("grape-mcp-install-claude-unsupported-", (rootPath) => {
    assert.throws(
      () =>
        installMcpClientConfig({
          rootPath,
          client: "claude",
          dryRun: true,
          platform: "win32",
          env: {},
          homeDir: ""
        }),
      /Use `grape mcp --print-config` for manual setup/
    );
  });
});

test("codex MCP install dry-run prints target and final TOML without writing", () => {
  withTempDir("grape-mcp-install-codex-dry-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--install", "--client", "codex", "--dry-run"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Dry run: no changes written/);
    assert.match(result.stdout, /Client: Codex/);
    assert.match(result.stdout, /Target: <repo-root>[\\/]\.codex[\\/]config\.toml/);
    assert.match(result.stdout, /Server command: grape mcp --stdio --repo <repo-root>/);
    assert.match(result.stdout, /CLI fallback: codex mcp add grape -- grape mcp --stdio --repo '?<repo-root>'?/);
    assert.match(result.stdout, /Final TOML:/);
    assert.match(result.stdout, /\[mcp_servers\.grape\]/);
    assert.equal(existsSync(codexConfigPath(rootPath)), false);
  });
});

test("codex MCP install creates project-local config", () => {
  withTempDir("grape-mcp-install-codex-fresh-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--install", "--client", "codex"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Wrote Grape MCP server config for Codex/);
    assert.match(result.stdout, /Server entry: \[mcp_servers\.grape\]/);
    assert.match(result.stdout, /Final TOML:/);
    const toml = readFileSync(codexConfigPath(rootPath), "utf8");
    assertCodexGrapeServer(toml, rootPath);
  });
});

test("codex MCP install preserves unrelated TOML and appends Grape server", () => {
  withTempDir("grape-mcp-install-codex-merge-", (rootPath) => {
    const targetPath = codexConfigPath(rootPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, "model = \"gpt-5.4\"\n\n[mcp_servers.docs]\ncommand = \"docs-server\"\nargs = [\"serve\"]\n");

    const result = runCli(rootPath, ["mcp", "--install", "--client", "codex"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Updated Grape MCP server config for Codex/);
    const toml = readFileSync(targetPath, "utf8");
    assert.match(toml, /model = "gpt-5\.4"/);
    assert.match(toml, /\[mcp_servers\.docs\]/);
    assertCodexGrapeServer(toml, rootPath);
  });
});

test("codex MCP install reports identical config as already configured", () => {
  withTempDir("grape-mcp-install-codex-identical-", (rootPath) => {
    const targetPath = codexConfigPath(rootPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, [
      "[mcp_servers.grape]",
      "command = \"grape\"",
      `args = ["mcp", "--stdio", "--repo", ${JSON.stringify(realpathSync(rootPath))}]`,
      `cwd = ${JSON.stringify(realpathSync(rootPath))}`,
      ""
    ].join("\n"));

    const result = runCli(rootPath, ["mcp", "--install", "--client", "codex"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already configured/);
    assertCodexGrapeServer(readFileSync(targetPath, "utf8"), rootPath);
  });
});

test("codex MCP install refuses conflicting Grape table unless forced", () => {
  withTempDir("grape-mcp-install-codex-conflict-", (rootPath) => {
    const targetPath = codexConfigPath(rootPath);
    const existing = "[mcp_servers.docs]\ncommand = \"docs-server\"\n\n[mcp_servers.grape]\ncommand = \"old-grape\"\nargs = []\n";
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, existing);

    const refused = runCli(rootPath, ["mcp", "--install", "--client", "codex"]);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /differs from the current Codex config/);
    assert.equal(readFileSync(targetPath, "utf8"), existing);

    const forced = runCli(rootPath, ["mcp", "--install", "--client", "codex", "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
    assert.match(forced.stdout, /Updated Grape MCP server config for Codex/);
    const toml = readFileSync(targetPath, "utf8");
    assert.match(toml, /\[mcp_servers\.docs\]/);
    assert.doesNotMatch(toml, /old-grape/);
    assertCodexGrapeServer(toml, rootPath);
  });
});

test("codex MCP install fails safely on malformed TOML header without overwriting", () => {
  withTempDir("grape-mcp-install-codex-invalid-", (rootPath) => {
    const targetPath = codexConfigPath(rootPath);
    const invalidToml = "[mcp_servers.grape\ncommand = \"old-grape\"\n";
    mkdirSync(path.dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, invalidToml);

    const result = runCli(rootPath, ["mcp", "--install", "--client", "codex"]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /malformed TOML table header/);
    assert.equal(readFileSync(targetPath, "utf8"), invalidToml);
  });
});

test("mcp --print-config keeps existing stdio connection contract", () => {
  withTempDir("grape-mcp-install-print-config-", (rootPath) => {
    const result = runCli(rootPath, ["mcp", "--print-config", "--repo", rootPath]);

    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.grapeMcp.status, "implemented");
    assert.deepEqual(parsed.grapeMcp.args, ["mcp", "--stdio", "--repo", "<repo-root>"]);
    assert.equal(parsed.grapeMcp.cwd, "<repo-root>");
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
