# NoLang MCP Server (Beta)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Enable any MCP Client like Claude Desktop or Agents to use the NoLang API to generate AI-powered videos

## What is NoLang?

NoLang is an AI-powered video generation service developed by Mavericks that creates videos in real-time. This MCP server provides a standardized interface to interact with the NoLang API.

- [NoLang Website](https://no-lang.com/)

## Prerequisites

- Python 3.12+
- NoLang API key (Get it from the NoLang dashboard: NoLang API > API Key)

## Installation

We recommend using `uv` to manage Python environments and dependencies.

### Install uv

#### macOS/Linux
```bash
# Using the official installer
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or using Homebrew
brew install uv
```

#### Windows
```powershell
# Using PowerShell
irm https://astral.sh/uv/install.ps1 | iex
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Add your NoLang API key to the `.env` file:
```
NOLANG_API_KEY=your_api_key_here
```

## Usage with Claude Desktop

Add the following to your Claude Desktop configuration file:

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nolang": {
      "command": "uvx",
      "args": ["nolang-mcp"],
      "env": {
        "NOLANG_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available MCP Tools

### generate_video
Generate a video from text input.
- `video_setting_id` (string, required): UUID of the video setting to use
- `text` (string, required): Text content for video generation

### get_video_status
Get the status and download URL of a generated video.
- `video_id` (string, required): UUID of the video to check

### list_videos
List all generated videos.
- `page` (integer, optional): Page number (default: 1)



## License

MIT License