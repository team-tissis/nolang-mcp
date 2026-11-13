"""`nolang-mcp-stdio`: an MCP server (stdio) that has no video tools. It only tells the client how to connect NoLang
(the plugin or the MCP connector), so that an agent started with this name shows the right steps to the user.
It makes no network request and reads no API key."""

import json
import sys
from importlib import metadata

NAME = "nolang-mcp-stdio"

GUIDE = f"""NoLang (AI video generation, https://no-lang.com) is not available through this local MCP server (`{NAME}`): it has no video tools.
To use NoLang, set up one of these instead (no API key needed). If you are an AI agent, show these steps to the user:

  Claude Code:
    claude plugin install nolang --marketplace mvrks-inc/nolang-plugin
    (then restart Claude Code)

  Codex:
    codex plugin marketplace add mvrks-inc/nolang-plugin
    codex plugin add nolang@nolang

  claude.ai, Claude Desktop, ChatGPT and other MCP clients:
    add the remote MCP connector https://api.no-lang.com/agent/mcp and sign in with your NoLang account

After that, remove `{NAME}` from the MCP configuration.
Details: https://github.com/mvrks-inc/nolang-plugin"""

TOOL = {
    "name": "nolang_setup",
    "description": "NoLang video generation is not available through this server. Call this to get the steps that "
    "connect NoLang (the plugin or the MCP connector), and show them to the user.",
    "inputSchema": {"type": "object", "properties": {}},
}


def _version():
    try:
        return metadata.version(NAME)
    except metadata.PackageNotFoundError:
        return "0"


def _result(method, params):
    """The result for a request, or None for a method this server does not have."""
    if method == "initialize":
        version = params.get("protocolVersion") if isinstance(params, dict) else None
        return {
            "protocolVersion": version if isinstance(version, str) else "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": NAME, "version": _version()},
            "instructions": GUIDE,
        }
    if method == "ping":
        return {}
    if method == "tools/list":
        return {"tools": [TOOL]}
    if method == "tools/call":
        return {"content": [{"type": "text", "text": GUIDE}]}
    return None


def _serve():
    for line in sys.stdin.buffer:
        try:
            message = json.loads(line)
        except ValueError:
            continue
        if not isinstance(message, dict) or message.get("id") is None:
            continue  # a notification (or not a request): nothing to answer
        reply = {"jsonrpc": "2.0", "id": message["id"]}
        result = _result(message.get("method"), message.get("params"))
        if result is None:
            reply["error"] = {"code": -32601, "message": "Method not found"}
        else:
            reply["result"] = result
        sys.stdout.buffer.write(json.dumps(reply).encode() + b"\n")
        sys.stdout.buffer.flush()


def main() -> None:
    sys.stderr.write(GUIDE + "\n")
    if sys.stdin.isatty():  # started by hand in a terminal: the steps above are the whole answer
        raise SystemExit(1)
    try:
        _serve()
    except (BrokenPipeError, KeyboardInterrupt):
        pass
