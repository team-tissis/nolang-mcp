#!/usr/bin/env node
// Claude Code hook (PreToolUse of Bash / Write / Read): approves, without a permission prompt, only the plumbing of the
// NoLang studio — so that making one video does not ask the user dozens of times (a worker takes a job and writes a
// part file again and again). It approves exactly three things:
//   1. one plain command of this plugin's own CLI (`node <plugin>/cli/nolang.mjs …`) that cannot send a local file:
//      `auth status`, `job take <dir>`, `wait <dir>`, and `make <dir>` with the flags listed in MAKE_FLAGS
//   2. a write of a studio part file inside the working directory (`…/stream/jobs/<job>/parts/NNN.txt`)
//   3. a read of this plugin's own skill documents (they live outside the working directory)
// Everything else — an upload (`assets upload`, `make --speech`), another endpoint (`--api`), a command chained to
// something else, any other file — gets no decision here and goes through the normal permission flow.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { plainWords } from "./tell-user.mjs";

// Flags of `nolang make` that carry only text or a choice (none reads a local file or changes the endpoint)
const MAKE_FLAGS = new Set(["--genre", "--type", "--mode", "--aspect", "--seconds", "--language", "--engine", "--request-text", "--editable", "--timeout"]);
const TIMEOUT_ONLY = new Set(["--timeout"]);

const flagsWithin = (words, allowed) => words.every((word) => !word.startsWith("--") || allowed.has(word.split("=")[0]));

// Is the command one plain call of this plugin's CLI that the studio's plumbing needs?
export function isPlumbingCommand(command, pluginRoot) {
  const root = String(pluginRoot ?? "").replace(/\/+$/, "");
  const words = plainWords(String(command ?? "").trim());
  if (!root || !words || words[0] !== "node" || words[1] !== `${root}/cli/nolang.mjs`) return false;
  const [verb, second, ...rest] = words.slice(2);
  if (verb === "auth") return second === "status" && rest.length === 0;
  if (verb === "job") return second === "take" && rest.length >= 1 && !rest[0].startsWith("--") && flagsWithin(rest.slice(1), TIMEOUT_ONLY);
  if (verb === "wait") return Boolean(second) && !second.startsWith("--") && flagsWithin(rest, TIMEOUT_ONLY);
  if (verb === "make") return Boolean(second) && !second.startsWith("--") && flagsWithin(rest, MAKE_FLAGS);
  return false;
}

// Is the path a part file of a studio job inside the working directory?
export function isPartFile(path, cwd) {
  const base = String(cwd ?? "").replace(/\/+$/, "");
  const file = String(path ?? "");
  return Boolean(base) && file.startsWith(`${base}/`) && !file.split("/").includes("..") && /\/stream\/jobs\/[\w.-]+\/parts\/\d{3}\.txt$/.test(file);
}

// Is the path one of this plugin's skill documents?
export function isSkillDocument(path, pluginRoot) {
  const root = String(pluginRoot ?? "").replace(/\/+$/, "");
  const file = String(path ?? "");
  return Boolean(root) && file.startsWith(`${root}/skills/`) && !file.split("/").includes("..");
}

// The reason to approve the tool call, or null to leave it to the normal permission flow
export function approval(event, pluginRoot) {
  const input = event?.tool_input ?? {};
  if (event?.tool_name === "Bash" && isPlumbingCommand(input.command, pluginRoot)) return "NoLang plugin: its own CLI (studio plumbing)";
  if (event?.tool_name === "Write" && isPartFile(input.file_path, event.cwd)) return "NoLang plugin: a studio part file";
  if (event?.tool_name === "Read" && isSkillDocument(input.file_path, pluginRoot)) return "NoLang plugin: its own skill document";
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const reason = approval(JSON.parse(readFileSync(0, "utf8")), process.env.CLAUDE_PLUGIN_ROOT);
    if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: reason } }) + "\n");
  } catch {
    // no decision — the normal permission flow asks the user
  }
}
