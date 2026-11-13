# nolang

The official launcher for [NoLang](https://no-lang.com), the AI video generation service by Mavericks, inc.
Describe a video in plain words and NoLang makes it: script, narration, pictures and BGM.

## Claude Code / Codex: install the plugin (recommended)

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

Codex: `codex plugin marketplace add mvrks-inc/nolang-plugin`, then `codex plugin add nolang@nolang`.

Restart Claude Code / Codex, then ask "Make a 60-second video about …". No API key is needed: the first time, you sign
in to your NoLang account in the browser. Details: https://github.com/mvrks-inc/nolang-plugin

Clients without a shell (claude.ai, ChatGPT, …): add the MCP connector `https://api.no-lang.com/agent/mcp`.

## Other environments: the CLI

```
pip install nolang     # or: uvx nolang <command>
nolang --help
```

This package only starts the Node package [`@no-lang/cli`](https://www.npmjs.com/package/@no-lang/cli) through `npx`,
so Node.js 20 or later is required. The command is `nolang` (`nolang auth login`, `nolang generate`, `nolang make`, …).
