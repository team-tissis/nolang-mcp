#!/usr/bin/env python3
"""
Run the NoLang MCP server
"""

import asyncio
from nolang_mcp.server import main

if __name__ == "__main__":
    asyncio.run(main())