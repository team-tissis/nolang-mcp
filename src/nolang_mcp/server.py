import os
import asyncio
import httpx
from typing import Any, Dict, List
from dotenv import load_dotenv

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, CallToolRequest, CallToolResult

load_dotenv()

NOLANG_API_KEY = os.getenv("NOLANG_API_KEY")
NOLANG_API_BASE_URL = "https://api.no-lang.com/v1"

if not NOLANG_API_KEY:
    raise ValueError("NOLANG_API_KEY environment variable is required")

app = Server("nolang-mcp")


class NoLangAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = NOLANG_API_BASE_URL
        self.headers = {"Authorization": f"Bearer {api_key}"}

    async def generate_video(self, video_setting_id: str, text: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/videos/generate/",
                headers=self.headers,
                data={
                    "video_setting_id": video_setting_id,
                    "text": text
                }
            )
            response.raise_for_status()
            return response.json()

    async def get_video_status(self, video_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/videos/{video_id}/",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def list_videos(self, page: int = 1) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/videos/",
                headers=self.headers,
                params={"page": page}
            )
            response.raise_for_status()
            return response.json()

    async def list_video_settings(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/video-settings/",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()


api = NoLangAPI(NOLANG_API_KEY)


@app.list_tools()
async def list_tools() -> List[Tool]:
    return [
        Tool(
            name="generate_video",
            description="Generate a video from text input",
            inputSchema={
                "type": "object",
                "properties": {
                    "video_setting_id": {
                        "type": "string",
                        "description": "UUID of the video setting to use"
                    },
                    "text": {
                        "type": "string",
                        "description": "Text content for video generation"
                    }
                },
                "required": ["video_setting_id", "text"]
            }
        ),
        Tool(
            name="get_video_status",
            description="Get the status and download URL of a generated video",
            inputSchema={
                "type": "object",
                "properties": {
                    "video_id": {
                        "type": "string",
                        "description": "UUID of the video to check"
                    }
                },
                "required": ["video_id"]
            }
        ),
        Tool(
            name="list_videos",
            description="List all generated videos",
            inputSchema={
                "type": "object",
                "properties": {
                    "page": {
                        "type": "integer",
                        "description": "Page number (default: 1)",
                        "default": 1
                    }
                }
            }
        ),
        Tool(
            name="list_video_settings",
            description="List available video settings",
            inputSchema={
                "type": "object",
                "properties": {}
            }
        )
    ]


@app.call_tool()
async def call_tool(tool_call: CallToolRequest) -> CallToolResult:
    try:
        if tool_call.name == "generate_video":
            video_setting_id = tool_call.arguments["video_setting_id"]
            text = tool_call.arguments["text"]
            
            result = await api.generate_video(video_setting_id, text)
            
            return CallToolResult(
                content=[TextContent(
                    type="text",
                    text=f"Video generation started!\n"
                         f"Video ID: {result['video_id']}\n"
                         f"Estimated wait time: {result['estimated_wait_time']} seconds"
                )]
            )

        elif tool_call.name == "get_video_status":
            video_id = tool_call.arguments["video_id"]
            
            result = await api.get_video_status(video_id)
            
            status_text = f"Video ID: {result['video_id']}\n"
            status_text += f"Status: {result['status']}\n"
            
            if result['status'] == 'completed' and result.get('download_url'):
                status_text += f"Download URL: {result['download_url']}"
            elif result['status'] == 'running':
                status_text += "Video is still being generated..."
            elif result['status'] == 'failed':
                status_text += "Video generation failed"
            
            return CallToolResult(
                content=[TextContent(type="text", text=status_text)]
            )

        elif tool_call.name == "list_videos":
            page = tool_call.arguments.get("page", 1)
            
            result = await api.list_videos(page)
            
            videos_text = f"Total videos: {result['count']}\n"
            videos_text += f"Page {page}\n\n"
            
            for video in result['results']:
                videos_text += f"Video ID: {video['video_id']}\n"
                videos_text += f"Created: {video['created_at']}\n"
                videos_text += f"Prompt: {video['prompt']}\n"
                videos_text += "-" * 50 + "\n"
            
            if result.get('next'):
                videos_text += "\nNext page available"
            
            return CallToolResult(
                content=[TextContent(type="text", text=videos_text)]
            )

        elif tool_call.name == "list_video_settings":
            result = await api.list_video_settings()
            
            settings_text = f"Total settings: {result['total_count']}\n\n"
            
            for setting in result['results']:
                settings_text += f"Setting ID: {setting['video_setting_id']}\n"
                settings_text += f"Title: {setting['title']}\n"
                settings_text += f"Required fields: {', '.join(setting['request_fields'])}\n"
                settings_text += f"Updated: {setting['updated_at']}\n"
                settings_text += "-" * 50 + "\n"
            
            return CallToolResult(
                content=[TextContent(type="text", text=settings_text)]
            )

    except httpx.HTTPStatusError as e:
        error_text = f"API Error: {e.response.status_code}\n"
        try:
            error_data = e.response.json()
            error_text += f"Code: {error_data.get('code', 'Unknown')}\n"
            error_text += f"Message: {error_data.get('error', 'Unknown error')}"
        except Exception:
            error_text += f"Response: {e.response.text}"
        
        return CallToolResult(
            content=[TextContent(type="text", text=error_text)]
        )
    except Exception as e:
        return CallToolResult(
            content=[TextContent(type="text", text=f"Error: {str(e)}")]
        )


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream)


if __name__ == "__main__":
    asyncio.run(main())