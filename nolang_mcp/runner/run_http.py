"""Entry point for NoLang MCP server over HTTP.

This entry point is an HTTP-based MCP server designed for remote access
and simultaneous connections from multiple clients.

Usage:
    python -m nolang_mcp.run_http
    or
    nolang-mcp-http

Environment Variables:
    PORT: HTTP server port number (default: 7310)
    NOLANG_API_KEY: NoLang API key (required)
"""

from nolang_mcp.config import nolang_mcp_config
from nolang_mcp.server import mcp


def main() -> None:
    """Start NoLang MCP server over HTTP."""
    port = nolang_mcp_config.nolang_mcp_port
    print(f"Starting NoLang MCP HTTP server on port {port}")

    mcp.run(
        transport="http",
        host="0.0.0.0",
        port=port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
