# Product Issues

This file tracks product and DX issues that shape upcoming implementation work but are not yet V1 contract changes.

## Active

### #10 Reduce Agent Read Amplification And Make MCP/Client Context Continuity First-Class

- GitHub issue: https://github.com/gael55x/Grape/issues/10
- Status: open
- Owner area: product positioning, MCP setup, agent workflow continuity, performance evidence

Direct feedback made the core problem clearer. For a single-repo codebase, Grape can look redundant if it is framed as another way for an agent to read files. Modern agents can already read the current repo.

The sharper problem is read amplification and context continuity:

- Agents repeatedly spend tool and token budget rereading files.
- Context does not survive cleanly across chats, tools, agents, and sessions.
- Manual MCP setup makes Grape easier to skip.
- Without a stable repo-backed session ledger, agents can continue from stale assumptions.
- Multi-repo and long-lived workflows may be the strongest wedge, but single-repo workflows still suffer once work spans multiple sessions.

Evidence from direct feedback included a Claude Code usage screenshot where Read tool output dominated usage, with Read around 60% of tool result tokens. Treat the screenshot as directional product evidence, not a committed benchmark artifact.

Product framing to test:

> Grape is not another repo reader. Grape is the repo-backed continuity and guardrail layer that helps agents avoid repeated rereads and stale context across sessions.

Next implementation work should stay scoped to the issue acceptance criteria before expanding into broader multi-repo orchestration.

Non-goals for the next pass:

- Do not treat CLI styling as the fix.
- Do not claim beta.7 includes automatic client config installation.
- Do not build broad client installers before config paths are safe.
- Do not claim proven read-reduction numbers until benchmark or client-trial evidence exists.
