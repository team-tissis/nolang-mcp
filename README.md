# NoLang for AI agents (Claude Code / Codex plugin · CLI · MCP)
English | [日本語](README.ja.md)

**[NoLang](https://no-lang.com)** is an AI video generation service: you describe a video in plain words and it makes one with a script, narration, pictures and BGM. With this plugin you ask Claude Code or Codex for a video and get back a link to watch it.

1. Install the plugin (one command, under "Install" below) and restart Claude Code / Codex.
2. Ask: "Make a 60-second video explaining tips for brewing great hand-drip coffee".
3. The first time, you are asked to sign in to NoLang in the browser. You need a NoLang account (it can be created on that screen; plans and prices: https://no-lang.com/pricing). A watch link appears in 1–2 minutes, and the video is kept in your NoLang account.

This repository distributes the pieces for using NoLang from AI agents (Apache-2.0). It has three parts. All of them use the same NoLang API and the same account behind the scenes.

| Item | Location | For |
|---|---|---|
| CLI **`@no-lang/cli`** (command name `nolang`) | `packages/cli/` (the bootstrap only — the CLI body is shipped by the NoLang server and brought up to date on every start) | Agents with a shell (Claude Code, Codex) and people |
| Skill **`make-video`** | `skills/make-video/` (a thin procedure guide; holds no copies of the docs) | The steps the agent reads |
| Plugin **`nolang`** | `plugins/nolang/` (made by the build: the CLI bootstrap + the skill + a Claude Code hook for link notifications. No MCP connection) | Installs into Claude Code / Codex in one step |

There are two entry points. Use only one per client. Clients with a shell use the plugin (CLI). Clients without a shell use the MCP connector.

| Entry point | Best for |
|---|---|
| **CLI `nolang`** | Agents with a shell. `nolang make` = your local LLM (your own Claude Code / Codex) writes the script and the screens following the studio steps (high quality). `nolang generate` = the NoLang server writes them (fast; no local LLM needed) |
| **MCP** `https://api.no-lang.com/agent/mcp` | Clients without a shell (claude.ai, ChatGPT, etc.) connect it as a connector. By default the model writes the draft and hands it over with `nolang_draft_submit` (cheaper in credits; the server checks and fixes it). When in a hurry, use `nolang_create_video` (request text → the server writes it). Status with `nolang_video_status`; fixes with `nolang_edit_video` |

## Install (once)

Requirements: **Node.js 20 or later**. `nolang make` also needs an execution engine (**Claude Code** or **Codex**; no python needed. Your local LLM writes the script, so it uses your own usage of that LLM — see "Requirements and limits" below). `nolang generate` runs with Node only (the server writes). For MCP, install nothing; just connect the connector.

Claude Code (one line in a terminal):

```
claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
```

Or ask Claude Code itself: "Install the NoLang plugin: run `claude plugin install nolang --marketplace mvrks-inc/nolang-plugin`". Inside Claude Code you can also use `/plugin marketplace add mvrks-inc/nolang-plugin` and `/plugin install nolang@nolang`.

Codex:

```
codex plugin marketplace add mvrks-inc/nolang-plugin
codex plugin add nolang@nolang
```

Restart after installing (in Claude Code, `/reload-plugins` also works). The CLI alone (no plugin) is also packaged for npm as `@no-lang/cli` (`npm install -g @no-lang/cli`, or `npx -y @no-lang/cli <command>`).

### Requirements and limits

- **Node.js 20 or later** must be on the machine. Claude Code itself does not include Node.js, so install it separately ([nodejs.org](https://nodejs.org/)). The plugin's hook also runs with `node`.
- **Restart Claude Code (or run `/reload-plugins`) after installing.** Until then the skill is not loaded.
- **`nolang make` uses your own Claude Code or Codex.** Claude Code must be signed in with a claude.ai subscription. With API-key-only, Bedrock or Vertex setups `nolang make` does not run; use `nolang generate` (the server writes) instead.
- **Cost of `nolang make`:** one video uses roughly 0.5–3 USD of your own LLM usage at API rates, depending on the mode (about 0.5–1 USD in the default mode). NoLang credits are consumed in addition, by video length.
- **Not supported yet:** Windows has not been verified, and corporate HTTP proxies are not supported.
- **What the plugin does on your machine:** on every start, `nolang` fetches the CLI body from `api.no-lang.com`, verifies its signature and runs it (details under "CLI" below).
- **Questions and problems:** open an issue at https://github.com/mvrks-inc/nolang-plugin/issues (attach the output of `nolang doctor`, or the watch URL).

## Sign in (once)

Ask Claude Code to **"Sign in to NoLang"** (if you don't, it asks you the first time you request a video). An approval URL appears (on the same machine, a browser also opens). Sign in to NoLang, press "Allow", and reply "I allowed it". The login expires if it is not used for 30 days.
Clients without a shell (claude.ai, etc.) sign in when you add `https://api.no-lang.com/agent/mcp` as a connector and connect. The plugin has no MCP connection (one client does not carry two entry points).

## Make a request

```
Make a 60-second video explaining tips for brewing great hand-drip coffee
Use this photo (~/Desktop/product.png) as the background and make a vertical video introducing our new product
Make a video explaining tips for working from home, with a calm female voice and piano BGM
```

- A watch URL appears in 1–2 minutes. In Claude Code, the link also appears in a notification that starts with `PostToolUse:Bash says:` (or `PostToolUseFailure:Bash says:`), before the agent's reply. You can play the video while it is still being generated; the rest grows while you watch.
- If you state vertical format, length or type (explainer / numbers / comparison / story / visual-led), you get that. If you don't, the video is 16:9 and the length is set to fit the content (auto). The video is made in the language of your request (ask in English and you get an English video. For a different language, write something like "in Japanese").
- Local photos and videos are uploaded as your own assets and used in the video. Voice, BGM, sound effects and fonts are chosen from descriptions (to decide yourself, say "find candidates for a ... voice").
- If you want the finished mp4, say "give me the mp4 link when it's done". "Fix this part of this video" makes a fixed video and keeps the original video.

### Troubleshooting

| Symptom | What to do |
|---|---|
| You opened the sign-in URL too late | It waits for 15 minutes. After that, say "Sign in to NoLang" again |
| You are told "claude is not found" | Installing it gives you the studio way of making videos (high quality). Without it, you can still make videos with `nolang generate` (the server writes) |
| Cannot connect / something seems wrong | Ask "run nolang doctor" and open an issue with the result (https://github.com/mvrks-inc/nolang-plugin/issues) |
| Generation ends as `failed` / there is no voice | This is usually on the server side, not in the draft. Open an issue with the watch URL (video_id) |
| Concurrent generation limit | You can have 2 videos generating at the same time on free / standard, and 5 on premium and business plans (counted per user). Wait for the previous video to finish |

## Update

The CLI body (including the studio and the reference docs) is shipped by the NoLang server at the API endpoint (`GET <api>/agent/client/`). On every start, `nolang` checks the local bundle (`~/.config/nolang/client/`) against the server and fetches it again. When the server is updated, the next `nolang` runs the new CLI body, so normally you do nothing.
Reinstall the plugin itself (bootstrap, skill, hook) only when this repo changes:

```
claude plugin marketplace update nolang
claude plugin uninstall nolang@nolang
claude plugin install nolang@nolang
```

After reinstalling, restart Claude Code. Your login is kept. Codex: `codex plugin marketplace upgrade nolang` → `codex plugin remove nolang@nolang` → `codex plugin add nolang@nolang` → restart.

## Layout

```
nolang-plugin/
  packages/cli/                        # CLI @no-lang/cli = the bootstrap (Node 20+, no dependencies). The CLI body is shipped by the NoLang server (it is not in this repo)
  packages/pypi-nolang/                # PyPI `nolang` = a launcher that starts @no-lang/cli through npx (holds the name)
  packages/pypi-nolang-mcp-stdio/      # PyPI `nolang-mcp-stdio` = holds the name; an MCP server that only tells how to connect NoLang
  skills/make-video/                   # Source of truth for the skill (makes videos with the CLI; also has the MCP steps for connector-only clients). Holds no copies of the docs
  agents/                              # Subagents that take the roles for `nolang make --engine host` (Claude Code only)
  hooks/                               # Claude Code hook: shows tell_user from nolang's output (video and sign-in URLs) on screen as a notification
  plugins/nolang/                      # Plugin package. cli/, skills/, agents/ and hooks/ are made from the source of truth by npm run build — do not edit them directly
    .claude-plugin/plugin.json         #   For Claude Code
    .codex-plugin/plugin.json          #   For Codex (no hooks listed)
  .claude-plugin/marketplace.json      # Marketplace for Claude Code (marketplace nolang; one plugin, nolang)
  .agents/plugins/marketplace.json     # Marketplace for Codex
  scripts/build-plugins.mjs            # Source of truth → plugins/nolang (--check checks for drift)
  .github/workflows/ci.yml             # npm run check and npm pack --dry-run
  LICENSE                              # Apache-2.0
```

## CLI

```
nolang auth login [--device | --browser] [--background] [--language <ja|en|…>] | login --no-browser | wait | complete '<URL>' | status | logout | env
nolang doctor                         Checks the API endpoint, the login, and whether you can make videos (balance)
nolang account [--language <ja|en|…>]   User language, plan, balance, whether free video generation is available, credits per minute of length, whether you can make one now (consumes nothing). --language changes the user's language
nolang make <dir> --genre <explain|film> --request-text "<request text>" [--aspect 16:9|9:16] [--seconds seconds|auto (default auto)] [--language <ja|en|…> (only to fix the video language)] [--engine claude|codex|host]
                                      Makes the video with the same steps as the NoLang studio (the skill's standard). Returns the URL once it can be played. For role and editable-mode flags, see nolang make --help
nolang generate --request-text "<request text>" [--aspect 16:9|9:16] [--seconds seconds] [--video-language <ja|en|…>] [--confirmed] [--idempotency-key key] [--wait]
                                      The NoLang server writes the script and the screens (the same entry point as home on the web; no studio). If the video language is omitted, it is the language of the request text. If stage=unsupported, show the blockers and resend with --confirmed
                                      If you lost the response and call again, pass the same --idempotency-key as the first call (no duplicate video)
nolang check [dir] --language <ja|en|…>   Checks design.txt / timeline.txt in dir (do not pass --language for a dir that has already been started)
nolang start [dir] --title "…" --language <ja|en|…> [--seconds seconds|auto]   Stream cut by cut: start only (stream.json in dir)
nolang submit [dir] [--end]           Submits newly written cuts (--end on the last; at most 600 seconds between submissions)
nolang create [dir] --title "…" --language <ja|en|…> [--seconds seconds|auto] [--aspect 16:9|9:16] [--wait] [--dry-run]   All cuts at once (for people using it by hand)
nolang stills <dir> [cut]             After nolang start: renders a cut that has not been submitted yet as stills, with the real pictures
nolang pull <dir> <video_id or URL>   Writes the saved draft of a template or of your own video to dir/reference/ (design.txt, timeline.txt, brief.md)
nolang transcribe <audio or video file or id>… [--speakers N]   Transcribes brought-in audio and returns the utterance ledger (consumes credit)
nolang edit <dir> <video_id or URL> --request-text "<what to fix>"   Fixes a finished video (the original video is kept; the language stays the same; the orientation changes if the request says so)
nolang status <video_id> [--wait] [--until playable|completed]   When completed, download_url (mp4) and copyright (credit line)
nolang abort <video_id>
nolang reference                      Returns the dir of the reference docs (grammar, samples, skeletons — the server's current version)
nolang assets search <kind> "<description or name>" [--mine]   Searches NoLang assets → ref (id=<uuid> etc.)
nolang assets upload <file>… [--name display-name] [--speakers N]   Uploads local images / videos / audio as your own assets → ref
```

- Results go to stdout as JSON; progress goes to stderr. Exit codes: 0 success / 1 draft defect or generation failure / 2 usage / 3 not signed in / 4 connection.
- The CLI body is a bundle shipped by the server at the API endpoint (`GET <api>/agent/client/`, a tar.gz of just under 1 MB). On every start, `nolang` checks the local bundle (`~/.config/nolang/client/<fingerprint>/`) with `If-None-Match` (one round trip; if the server cannot be reached, it runs on the local bundle) and fetches it again if it changed. On the first start, when there is no local bundle, if the server cannot be reached or returns 5xx, it retries up to 3 times in total, waiting 3 seconds and then 6 seconds (to ride out a server swap; about 70 seconds at most). There is no version number; the fingerprint = the sha256 of the tar.gz. This README has no flag table — `nolang make --help` prints the one from the same version as the server.
- The bundle (= the code that runs) is fetched only from production (`api.no-lang.com`). The server build signs the production bundle with Ed25519, and the bootstrap verifies it with the public key (built into `packages/cli/nolang.mjs`) before running it — a bundle with no signature or a signature that does not match is not run. `--api` may be given only once. It fetches from another NoLang server (a local stack on `localhost` included) only when a person writes `NOLANG_CLIENT_TRUSTED_ORIGIN=<that URL>` in the shell (bundles from that origin run even without a signature). To run the CLI from a local checkout, use `NOLANG_CLIENT_DIR` (no fetch).
- Link notifications: when a command's output has `tell_user` (a message that includes the video or sign-in URL), the plugin's hook (`hooks/`) shows it as a notification on the Claude Code screen without going through the model (it arrives even if the model forgets to write the link). It also fires when `nolang` exits with an error (sign-in needed, not enough credit). It is shown only when the command is one plain `nolang` invocation (not `nolang …; something else`, a pipe, or `cat` of a file), and only when every link in the message is on `no-lang.com` (or `localhost`), so other output cannot pose as a NoLang notification.
- Permission prompts: making one video takes dozens of small steps (a worker takes a job, writes a part file, and repeats). The plugin's hook approves only that plumbing without asking: `auth status`, `job take`, `wait` and a `make` that carries only text and choices, run as one plain command of this plugin's own CLI; a write of a studio part file (`…/stream/jobs/<job>/parts/NNN.txt`) inside the working directory; and a read of the plugin's own skill documents. Anything that can send a local file (`assets upload`, `make --speech`), another endpoint (`--api`), a command chained to something else, and every other file still go through Claude Code's normal permission prompt.
- API endpoint: `--api <URL>` → environment variable `NOLANG_API_URL` → production (`https://api.no-lang.com`). It is a URL only; there is no command that selects and saves an endpoint (point at a non-production NoLang server with `NOLANG_API_URL` and `NOLANG_CLIENT_TRUSTED_ORIGIN` in the shell). Logins are kept per endpoint, and signing in does not change the endpoint.
- Sign-in: on a local machine, including an agent's `--background`, it uses browser authorization (a browser opens and you just approve; no code to enter. If it cannot start, it switches to device authorization automatically). SSH, remote containers, Docker, WSL and Linux without a display choose device authorization: enter the URL and code in a browser and approve (no port forwarding needed). The agent receives the instructions (and the code, for device authorization) with `--background` and checks completion with `nolang auth wait`. You can choose explicitly with `--device` / `--browser`. Even if the browser authorization's return address gives a connection error, you can paste it back into the login already started with `auth complete '<URL after approval>'` (also works with `--background`). The token is in `~/.config/nolang/credentials.json` (0600) and is refreshed automatically when it expires (sign in again if it is not used for 30 days).
- Non-interactive use such as CI: put an access token (the one `eval "$(nolang auth env)"` outputs; it expires in 1 hour and the CLI does not refresh it) in `NOLANG_TOKEN`. An API key (`nlg-c-…`) does not work with the CLI or MCP (403; it is for the NoLang API).
- Sign-in uses the same authorization server as MCP (OAuth 2.1, PKCE, received on `127.0.0.1`). The client is registered automatically on each sign-in (DCR).

### Studio execution engine

`nolang make ... --engine codex` runs each call of the author, staff and fixer roles with the local `codex exec` (the non-interactive launch of the Codex CLI as distributed). `codex exec` returns once, after it finishes writing the body, so playback starts later than with Claude, which streams as it writes. The default Claude model, effort and prompts do not change.

Codex runs in a temporary environment that shares only `auth.json` from the original `CODEX_HOME` (default `~/.codex`) and does not load the user's settings, hooks, plugins, MCP or conversation history. The model is that Codex CLI's default. Authentication with only an API key environment variable, or only a keyring, is not supported at present. A record of each call (role, effort, duration, tokens) is kept in `stream/run.jsonl`, and errors in `stream/codex_*.err`.

In Codex, the plugin prefers `--engine codex` when the local CLI and its authentication are available, even if subagents are available. When the CLI or its authentication is unavailable before generation starts, it falls back to `--engine host` if the session has a shell and subagents.

`nolang make ... --engine host` starts no LLM CLI: the subagents of the session that called `nolang` write the draft. Claude Code uses it when the `claude` command is not available. How to start the roles and how many to run at once are in the skill's `host-engine.md`. Codex needs no agent definition and no extra setting for this fallback.

Draft checks, assets and rendering for the CLI / MCP use the same NoLang server. The author, staff and fixer are written by your local LLM (its CLI, or the subagents of the host session), so remote MCP clients without a shell use `nolang_create_video` (the server writes) or the steps for writing the draft yourself and submitting it.

## Development

Edit only the source of truth (`packages/cli/`, `skills/`, `agents/`, `hooks/`). After editing:

```
npm run build       # Source of truth → plugins/nolang/ (rebuilds cli/, skills/, agents/ and hooks/, and aligns the manifest version with the bootstrap)
npm run check       # Whether plugins/ matches the source of truth + the bootstrap and hook tests (same as CI)
npm run validate    # claude plugin validate --strict (needs Claude Code)
```

- The version number (`packages/cli/package.json`) belongs to the bootstrap. The build copies it into the two `plugin.json` files. The CLI body has no version (the bundle's fingerprint — `nolang --version`).
- **Every change to what ships in `plugins/nolang/` needs a version bump** (`packages/cli/package.json`, then `npm run build`). Claude Code and Codex compare the version string: without a bump, `claude plugin update` says "already at the latest version" and users keep the old copy.
- The CLI body is not in this repo: it is developed in NoLang's backend (a private repository) and shipped by the server. For a problem in the CLI body, open an issue here.
- Picking up changes: Claude Code reads this repo directly, so start the next session or run `/reload-plugins`. Codex copies it into `~/.codex/plugins/cache/` at install time, so reinstall (`codex plugin remove nolang@nolang` → `codex plugin add nolang@nolang`).

Placement rules (so it works in both Claude Code and Codex):
- Put the plugin package in a subdirectory under the marketplace. If the plugin package is in the same directory as the marketplace (`./`), Claude Code reads it but Codex ignores the whole marketplace.
- Put no MCP connection settings (`mcpServers`, `.mcp.json`) in either the marketplace or the plugin package. Clients that install the plugin have a shell, so they use the CLI — adding MCP to the same client would duplicate the way videos are made and the login.
- Put the actual files of the CLI (bootstrap) and the skill inside the plugin package (not symlinks). Codex copies the whole plugin package into its cache, so the relative path from the skill (`../../cli/nolang.mjs`) is the same in both. The skill calls `${CLAUDE_PLUGIN_ROOT}/cli/nolang.mjs` in Claude Code, and in Codex, which has no `CLAUDE_PLUGIN_ROOT`, it calls this relative path made absolute.

### Docs and the studio (the NoLang server is the source of truth; no copies here)

The grammar reference docs and the CLI body (including the runner for `nolang make` / `nolang edit`) are maintained in NoLang's backend. The server runs the `make` / `edit` steps (check, assigning staff, fixes, submission); the runner only executes, with the local CLI, the LLM
calls the server asks for — the bundle has no python scripts. The server packs the CLI body and the docs into one bundle and ships it at `GET agent/client/`, and the bootstrap fetches it on every start — this repo has no copies and
no sync workflow. The skill has no copies of the docs either — the
write-it-yourself path reads the server's current version with `nolang reference` (the docs directory inside the bundle) or MCP's `nolang_draft_reference`.

`SKILL.md` (the standard steps for making videos with the studio, sign-in, assets) and `write-yourself.md` (the write-it-yourself path) are written in this repo. For grammar, the agent is
told to read the server's `spec.md`; for `nolang make` flags, `--help` (they are not copied into the procedure docs — outside the bundle they would go stale).

## Distribution

- **license**: Apache-2.0 (`LICENSE`).
- **npm**: `@no-lang/cli` (the command name is `nolang`). The unscoped `nolang` on npm is a separate package unrelated to NoLang; do not use it.
- **PyPI**: [`nolang`](https://pypi.org/project/nolang/) and [`nolang-mcp-stdio`](https://pypi.org/project/nolang-mcp-stdio/). `nolang` only starts `@no-lang/cli` through `npx`; `nolang-mcp-stdio` only holds the name (an MCP server with no video tools; it tells the client how to connect NoLang).
- **GitHub**: `mvrks-inc/nolang-plugin`. It installs with `claude plugin install nolang --marketplace mvrks-inc/nolang-plugin` (or `/plugin marketplace add mvrks-inc/nolang-plugin`).

## Roadmap

- Applying to OpenAI's plugin directory and Anthropic's connector directory (after release).
