"""Launcher for the official NoLang CLI. The CLI itself is the Node package `@no-lang/cli`; this only starts it."""

import shutil
import subprocess
import sys

# Pinned: a new npm release reaches users of this package only through a new release of this package
NPM_PACKAGE = "@no-lang/cli@0.0.1"
HELP = """The NoLang CLI runs on Node.js (20 or later), and `npx` was not found on this machine.

Install Node.js from https://nodejs.org/ and run the same command again.

"""
PLUGIN = """NoLang (AI video generation, https://no-lang.com). In Claude Code or Codex, install the plugin instead of this CLI
(it adds the skill that makes videos from a plain request; no Python needed):
  Claude Code:
    claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
  Codex:
    codex plugin marketplace add mvrks-inc/nolang-plugin
    codex plugin add nolang@nolang
"""


def main() -> None:
    # Someone (or an agent) looking at what this is: say first that the plugin is the way in for Claude Code / Codex
    asking = not sys.argv[1:] or sys.argv[1] in ("--help", "-h", "help")
    if asking:
        sys.stderr.write(PLUGIN + "\n")
    npx = shutil.which("npx")
    if npx is None:
        sys.stderr.write(HELP if asking else HELP + "\n" + PLUGIN)
        raise SystemExit(127)
    raise SystemExit(subprocess.call([npx, "-y", NPM_PACKAGE, *sys.argv[1:]]))
