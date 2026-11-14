#!/usr/bin/env node
// Claude Code hook (PostToolUse / PostToolUseFailure of Bash): when nolang's output carries `tell_user` (a message with
// the video or sign-in URL), show it on the user's screen as a notification, without going through the model. The link is
// visible the moment the command returns, even if the model forgets to write it or goes on to run a long command.
// A command that exits non-zero arrives as PostToolUseFailure (its output is in `error`) — nolang exits non-zero exactly
// when the user has something to do (sign in, add credit), so both events are handled.
// A notification reads as "NoLang said this", so it is shown only when the command is one plain nolang invocation, and
// only when every URL or domain in the message is NoLang's (output of `cat file`, of `nolang …; something else`, or text
// with a link from elsewhere is never shown — a fake link must not look like a NoLang notification)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The top-level `tell_user` of the last JSON object in the output, or null. nolang prints one pretty-printed object
// (from a line `{` to a line `}`); on a failure the output also carries the exit code line and stderr around it
export function tellUserOf(output) {
  const lines = String(output ?? "").split("\n").map((line) => line.trimEnd());
  let text = null;
  for (let i = 0; i < lines.length; i++) {
    let block = null;
    if (lines[i] === "{") {
      const end = lines.indexOf("}", i + 1);
      if (end < 0) break;
      block = lines.slice(i, end + 1).join("\n");
      i = end;
    } else if (lines[i].startsWith("{") && lines[i].endsWith("}")) {
      block = lines[i];
    }
    if (!block) continue;
    try {
      const value = JSON.parse(block).tell_user;
      if (typeof value === "string" && value) text = value;
    } catch {
      // not JSON — keep looking
    }
  }
  return text;
}

// Split a shell command into words, or null when it is more than one plain command: an unquoted `;` `&` `|` newline,
// redirection, parenthesis or comment, or a command substitution (`$(…)`, a backtick) outside single quotes.
// Quoted text (the request text of `nolang make`) may contain any of these
export function plainWords(command) {
  const words = [];
  let word = null;
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
    } else if (c === "`" || (c === "$" && command[i + 1] === "(")) {
      return null;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === "\\" && i + 1 < command.length) word += command[++i];
      else word += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word ??= "";
    } else if (c === "\\" && i + 1 < command.length) {
      word = (word ?? "") + command[++i];
    } else if (c === " " || c === "\t") {
      if (word !== null) words.push(word);
      word = null;
    } else if (";&|<>()\n".includes(c) || (c === "#" && word === null)) {
      return null;
    } else {
      word = (word ?? "") + c;
    }
  }
  if (quote) return null;
  if (word !== null) words.push(word);
  return words;
}

// Is the command one plain nolang invocation? `nolang …`, `node <path>/nolang.mjs …` (the plugin bootstrap),
// `npx [-y] @no-lang/cli …` or `uvx nolang …`, optionally after `cd <dir> &&` and `NAME=value` assignments, and with a
// trailing `2>&1`
const CD_PREFIX = /^cd\s+(?:"[^"$`\\]*"|'[^']*'|[^\s;&|<>()$`'"\\]+)\s*&&\s*/;
export function isNolangCommand(command) {
  const words = plainWords(String(command ?? "").trim().replace(CD_PREFIX, "").replace(/\s+2>&1$/, ""));
  if (!words) return false;
  while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
  const [first, ...rest] = words;
  const base = (word) => String(word ?? "").split("/").pop();
  if (base(first) === "nolang") return true;
  if (base(first) === "node") return base(rest[0]) === "nolang.mjs";
  if (base(first) === "npx") return /^@no-lang\/cli(@[\w.-]+)?$/.test(rest.find((word) => !word.startsWith("-")) ?? "");
  if (base(first) === "uvx") return rest[0] === "nolang";
  return false;
}

// Is every link in the message NoLang's? URLs must be http(s) on no-lang.com or a subdomain (localhost is for local
// development), a bare domain (`example.com/login`) must be NoLang's too, and a markdown link (which can show one URL
// and open another) is refused
const NOLANG_HOST = /^(([a-z0-9-]+\.)*no-lang\.com|localhost|127\.0\.0\.1)$/;
export function onlyNolangUrls(text) {
  if (text.includes("](")) return false;
  for (const [raw] of text.matchAll(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi)) {
    try {
      const url = new URL(raw);
      if (!/^https?:$/.test(url.protocol) || !NOLANG_HOST.test(url.hostname)) return false;
    } catch {
      return false;
    }
  }
  for (const [, domain] of text.matchAll(/(?<![\w@/.:-])((?:[a-z0-9-]+\.)+[a-z]{2,})(?![\w-])/gi)) {
    if (!NOLANG_HOST.test(domain.toLowerCase())) return false;
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const text = isNolangCommand(input.tool_input?.command) ? tellUserOf(input.tool_response?.stdout ?? input.error) : null;
    if (text && onlyNolangUrls(text)) process.stdout.write(JSON.stringify({ systemMessage: text }) + "\n");
  } catch {
    // the notification is a convenience — a hook failure must not stop the work
  }
}
