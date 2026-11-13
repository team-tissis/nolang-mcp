# @no-lang/cli

日本語の説明: https://github.com/mvrks-inc/nolang-plugin/blob/main/README.ja.md

A CLI for making NoLang videos from AI agents (Claude Code / Codex, etc.). The command name is `nolang`.

> Note: the unscoped `nolang` on npm is a separate package unrelated to NoLang. Always use `@no-lang/cli`.

## From Claude Code / Codex, use the plugin

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

For Codex: `codex plugin marketplace add mvrks-inc/nolang-plugin` → `codex plugin add nolang@nolang`. Restart after installing (in Claude Code, `/reload-plugins` also works).
Use this package directly in environments without a plugin system (CI, other agents).

## Install

```
npm install -g @no-lang/cli     # then run `nolang …`
npx @no-lang/cli <command>      # use without installing
```

Requires Node.js 20 or later. There are no dependency packages.

This package is the bootstrap. The CLI body (including the `nolang make` runner and the reference docs) is shipped by the NoLang server at the API endpoint (`GET <api>/agent/client/`). On every start, `nolang` checks the local bundle (`~/.config/nolang/client/`) against the server, fetches it again if it changed, and then runs (the check is one round trip; a re-fetch is just under 1 MB). The bundle is fetched only from production (`api.no-lang.com`) and runs only after its signature with NoLang's key is verified. When the server is updated, the next `nolang` runs the new CLI body, so there is no work to update the CLI.

## Usage

```
nolang auth login                     Sign in to NoLang (browser when local, code entry when remote)
nolang doctor                         Checks the API endpoint, the login, and whether you can make videos (balance)
nolang make <dir> --type concept --request-text "…"   Makes the video with your own Claude Code / Codex (watch URL once it can be played)
nolang generate --request-text "…" --idempotency-key <key>   The NoLang server writes the script and the screens (no local LLM needed)
nolang edit <dir> <video_id> --request-text "…"   Fixes a finished video (the original video is kept; new URL)
nolang status <video_id> --wait       Waits for completion and gets the mp4 URL (download_url) and the credit line (copyright)
```

`nolang --help` lists all commands. Results go to stdout as JSON; progress goes to stderr. Exit codes: 0 success / 1 draft defect or generation failure / 2 usage / 3 not signed in / 4 connection.

The full command list, the API endpoint, sign-in, tokens for CI and the Codex engine are described in the repository README: https://github.com/mvrks-inc/nolang-plugin#cli

## License

Apache-2.0 (`LICENSE`).
