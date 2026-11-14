import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { approval, isPartFile, isPlumbingCommand, isSkillDocument } from "../../../hooks/allow-nolang.mjs";

const HOOK = fileURLToPath(new URL("../../../hooks/allow-nolang.mjs", import.meta.url));
const ROOT = "/home/u/.claude/plugins/cache/nolang/nolang/0.0.1";
const CLI = `node ${ROOT}/cli/nolang.mjs`;

test("the studio's plumbing commands of this plugin's CLI are approved", () => {
  for (const command of [
    `${CLI} auth status`,
    `${CLI} job take /w/nolang-videos/a`,
    `node "${ROOT}/cli/nolang.mjs" job take "/w/nolang videos/a" --timeout 100`,
    `${CLI} wait /w/nolang-videos/a --timeout 420`,
    `${CLI} make ./nolang-videos/a --genre explain --mode plus --aspect 16:9 --request-text 'a | b; c' --engine host`,
    `${CLI} make ./nolang-videos/a --genre film --request-text "x" --seconds 30 --language ja`,
  ]) {
    assert.equal(isPlumbingCommand(command, ROOT), true, command);
  }
});

test("a command that can send a local file, change the endpoint or run something else is left to the user", () => {
  for (const command of [
    `${CLI} assets upload ~/.ssh/id_rsa`,
    `${CLI} make ./a --genre explain --request-text x --speech ./talk.m4a`,
    `${CLI} make ./a --genre explain --request ./notes.txt`,
    `${CLI} make ./a --genre explain --request-text x --api https://example.com`,
    `${CLI} auth login`,
    `${CLI} auth status --api https://example.com`,
    `${CLI} generate --request-text x`,
    `${CLI} auth status && rm -rf ~`,
    `${CLI} make ./a --request-text "$(cat ~/.ssh/id_rsa)"`,
    `${CLI} job take /w/a > /tmp/out`,
    `node /somewhere/else/cli/nolang.mjs job take /w/a`,
    `node ${ROOT}/cli/../cli/nolang.mjs job take /w/a`,
    `cd /w && ${CLI} auth status`,
    `X=1 ${CLI} auth status`,
    `nolang job take /w/a`,
  ]) {
    assert.equal(isPlumbingCommand(command, ROOT), false, command);
  }
  assert.equal(isPlumbingCommand(`${CLI} auth status`, undefined), false);
});

test("only a part file of a studio job inside the working directory is approved for writing", () => {
  assert.equal(isPartFile("/w/nolang-videos/a/stream/jobs/author/parts/001.txt", "/w"), true);
  assert.equal(isPartFile("/w/nolang-videos/a/stream/jobs/003_fixer_0349442c/parts/001.txt", "/w/"), true);
  assert.equal(isPartFile("/w/src/app.py", "/w"), false);
  assert.equal(isPartFile("/w/nolang-videos/a/stream/jobs/author/parts/notes.md", "/w"), false);
  assert.equal(isPartFile("/etc/stream/jobs/a/parts/001.txt", "/w"), false);
  assert.equal(isPartFile("/w/x/../../etc/stream/jobs/a/parts/001.txt", "/w"), false);
  assert.equal(isPartFile("/w/nolang-videos/a/stream/jobs/author/parts/001.txt", undefined), false);
});

test("only this plugin's skill documents are approved for reading", () => {
  assert.equal(isSkillDocument(`${ROOT}/skills/make-video/host-engine.md`, ROOT), true);
  assert.equal(isSkillDocument(`${ROOT}/skills/../../secrets.txt`, ROOT), false);
  assert.equal(isSkillDocument("/home/u/.ssh/id_rsa", ROOT), false);
  assert.equal(isSkillDocument(`${ROOT}/skills/make-video/SKILL.md`, ""), false);
});

test("the hook prints an allow decision for plumbing and nothing for anything else", () => {
  const hook = (event) => execFileSync("node", [HOOK], { input: JSON.stringify(event), encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT } });
  const allowed = JSON.parse(hook({ tool_name: "Bash", tool_input: { command: `${CLI} job take /w/a` }, cwd: "/w" }));
  assert.equal(allowed.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(allowed.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(hook({ tool_name: "Bash", tool_input: { command: `${CLI} assets upload /w/a.png` }, cwd: "/w" }), "");
  assert.equal(hook({ tool_name: "Write", tool_input: { file_path: "/w/README.md" }, cwd: "/w" }), "");
  assert.equal(hook({ tool_name: "Edit", tool_input: { file_path: "/w/nolang-videos/a/stream/jobs/author/parts/001.txt" }, cwd: "/w" }), "");
  assert.equal(approval(null, ROOT), null);
});
