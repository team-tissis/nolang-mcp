"""Entry point for NoLang MCP server over STDIO.

This entry point is used when working locally with
STDIO-based MCP clients such as Claude Desktop.

Usage:
    python -m nolang_mcp.run_stdio
    or
    nolang-mcp-stdio
"""

from nolang_mcp.server import mcp


def main() -> None:
    """Start NoLang MCP server over STDIO."""
    mcp.run()


if __name__ == "__main__":
    main()
