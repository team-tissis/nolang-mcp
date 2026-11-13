# nolang-mcp-stdio

[NoLang](https://no-lang.com) (AI video generation by Mavericks, inc.) holds this name so that nobody else can publish
under it. The command is an MCP server (stdio) with no video tools: it only tells the client how to connect NoLang, so an
agent started with this name shows the steps below to the user. It makes no network request and reads no API key.

Connect NoLang with one of these (no API key needed):

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

Codex: `codex plugin marketplace add mvrks-inc/nolang-plugin`, then `codex plugin add nolang@nolang`.

Clients without a shell (claude.ai, ChatGPT, …): add the MCP connector `https://api.no-lang.com/agent/mcp` and sign in
with your NoLang account.

Details: https://github.com/mvrks-inc/nolang-plugin
