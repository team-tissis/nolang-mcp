# NoLang MCP Server

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

1. Set your NoLang API key to the environment variable:
```bash
export NOLANG_API_KEY=your_api_key_here
```

## Usage

### STDIO Mode (Claude Desktop etc.)

STDIO mode is designed for local clients such as Claude Desktop.

#### Claude Desktop Configuration

Add the following to your Claude Desktop configuration file:

#### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

#### Windows
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nolang": {
      "command": "uvx",
      "args": ["nolang-mcp-stdio"],
      "env": {
        "NOLANG_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### Direct Execution
```bash
# Start in STDIO mode
nolang-mcp-stdio

# or
python -m nolang_mcp.runner.run_stdio
```

### HTTP Mode (Remote Access & Multiple Clients)

HTTP mode supports remote access via web and concurrent connections from multiple clients.

```bash
# Start in HTTP mode (default port: 7310)
nolang-mcp-http

# or
python -m nolang_mcp.runner.run_http

# Start with custom port
NOLANG_MCP_PORT=8080 nolang-mcp-http
```

### HTTP mode: expose as remote MCP server (Cloudflare Tunnel / no DNS or auth)

Expose your local MCP HTTP server instantly using Cloudflare Tunnel Quick Tunnel. This generates a temporary `trycloudflare.com` URL with no DNS or authentication setup required.

```bash
# 1) Install Cloudflare Tunnel CLI (macOS)
brew install cloudflared

# 2) Start the MCP server in another terminal (requires API key)
export NOLANG_API_KEY=your_api_key_here
# Optional: change port (default: 7310)
# export NOLANG_MCP_PORT=7310
nolang-mcp-http
# or
# python -m nolang_mcp.runner.run_http

# 3) Start a Quick Tunnel in a new terminal
cloudflared tunnel --url http://localhost:${NOLANG_MCP_PORT:-7310}
# You will get a URL like: https://xxxxx.trycloudflare.com
```

- The issued URL is random and temporary. For longer-term or access-controlled setups, consider a Named Tunnel or Cloudflare Access.


## Available MCP Tools

### generate_video_with_setting
Consumes paid credits. Start video generation using your VideoSetting ID.

**Required Parameters:**
- `video_setting_id` (string): UUID of VideoSetting (obtainable via `list_video_settings`)

**Optional Parameters (at least one is required):**
- `text` (string): Text prompt (for QUERY modes or slideshow_analysis mode)
- `pdf_path` (string): Absolute path to PDF file (for slideshow_* modes)
- `pptx_path` (string): Absolute path to PPTX file (for slideshow_* modes)
- `audio_path` (string): Absolute path to audio file (for audio_speech mode, MP3/WAV/M4A/AAC)
- `video_path` (string): Absolute path to video file (for audio_video mode, MP4)
- `image_paths` (string): Image file paths (comma-separated, for QUERY modes)

### generate_video_with_template
Consumes paid credits. Start video generation using an official template Video ID.

**Required Parameters:**
- `video_id` (string): ID of generated or generating video

**Optional Parameters:**
- Same parameters as `generate_video_with_setting` are available

### wait_video_generation_and_get_download_url
Polls until video generation completes and returns the download URL.

**Parameters:**
- `video_id` (string, required): Video ID of the generation job
- `max_wait_time` (integer, optional): Maximum wait time in seconds (default: 600)
- `check_interval` (integer, optional): Status check interval in seconds (default: 10)

### list_generated_videos
Return a paginated list of videos you have generated.

**Parameters:**
- `page` (integer, optional): Page number (default: 1)

### list_video_settings
Return a paginated list of your VideoSettings.

**Parameters:**
- `page` (integer, optional): Page number (default: 1)

### recommend_templates
Recommend official templates based on video mode and optional query.


## Project Structure

- `nolang_mcp/server.py`: Common MCP server definition and API client
- `nolang_mcp/runner/run_stdio.py`: Entry point for STDIO
- `nolang_mcp/runner/run_http.py`: Entry point for HTTP


## License

MIT License