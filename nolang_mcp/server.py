import asyncio
import time
from typing import Any, Dict, Union
from uuid import UUID

import httpx
from fastmcp import Context, FastMCP

from nolang_mcp.api_client import format_http_error, nolang_api
from nolang_mcp.models import (
    ListVideosArgs,
    ListVideoSettingsArgs,
    ListVideoSettingsResult,
    ListVideosResult,
    TemplateRecommendationArgs,
    TemplateRecommendationResult,
    TemplateSummary,
    VideoGenerationFromSettingArgs,
    VideoGenerationFromVideoArgs,
    VideoGenerationResult,
    VideoSettingSummary,
    VideoStatusEnum,
    VideoStatusResult,
    VideoSummary,
    VideoWaitArgs,
)

mcp: FastMCP[Any] = FastMCP(
    name="nolang-mcp",
    instructions="Generate and manage NoLang video generation jobs.",
)


async def _generate_video(
    setting: Union[UUID, str, Dict[str, Any]],
    text: str = "",
    pdf_path: str = "",
    pptx_path: str = "",
    audio_path: str = "",
    video_path: str = "",
    image_paths: str = "",
) -> VideoGenerationResult:
    """Generate a video and return a structured response."""

    try:
        # PDF analysis mode
        if pdf_path and text:
            result = await nolang_api.generate_video_with_pdf_and_text(setting, pdf_path, text)
        # PDF mode
        elif pdf_path:
            result = await nolang_api.generate_video_with_pdf(setting, pdf_path)
        # PPTX mode
        elif pptx_path:
            result = await nolang_api.generate_video_with_pptx(setting, pptx_path)
        # Audio mode
        elif audio_path:
            result = await nolang_api.generate_video_with_audio(setting, audio_path)
        # Video mode
        elif video_path:
            result = await nolang_api.generate_video_with_video(setting, video_path)
        # Text mode (with/without images)
        elif text:
            image_files = None
            if image_paths:
                image_files = [p.strip() for p in image_paths.split(",") if p.strip()]
            result = await nolang_api.generate_video_with_text(setting, text, image_files)
        else:
            raise ValueError("At least one of text, pdf_path, pptx_path, audio_path or video_path must be provided")

        return VideoGenerationResult(video_id=result.video_id)
    except httpx.HTTPStatusError as e:
        # Surface HTTP errors back to the LLM as a structured object
        raise RuntimeError(format_http_error(e)) from e
    except FileNotFoundError as e:
        raise RuntimeError(str(e)) from e


@mcp.tool(
    name="generate_video_with_setting",
    description="Consumes paid credits. Start video generation using your VideoSetting ID. Provide text, pdf_path, pptx_path, audio_path, video_path, or image_paths as required.",
)
async def generate_video_with_setting(
    args: VideoGenerationFromSettingArgs,
) -> VideoGenerationResult:
    return await _generate_video(
        args.video_setting_id,
        args.text,
        args.pdf_path,
        args.pptx_path,
        args.audio_path,
        args.video_path,
        args.image_paths,
    )


@mcp.tool(
    name="generate_video_with_template",
    description="Consumes paid credits. Start video generation using an official template Video ID. Provide text, pdf_path, pptx_path, audio_path, video_path, or image_paths as required.",
)
async def generate_video_with_template(
    args: VideoGenerationFromVideoArgs,
) -> VideoGenerationResult:
    video_setting_data = await nolang_api.get_video_setting_from_video_id(args.video_id)
    return await _generate_video(
        video_setting_data,
        args.text,
        args.pdf_path,
        args.pptx_path,
        args.audio_path,
        args.video_path,
        args.image_paths,
    )


@mcp.tool(
    name="wait_video_generation_and_get_download_url",
    description="Polls until video generation completes and returns the download URL.",
)
async def wait_video_generation_and_get_download_url(
    args: VideoWaitArgs,
    ctx: Context,
) -> VideoStatusResult:
    start = time.time()

    while time.time() - start < args.max_wait_time:
        try:
            status_response = await nolang_api.get_video_status(args.video_id)
        except httpx.HTTPStatusError as e:
            raise RuntimeError(format_http_error(e)) from e

        current_status = VideoStatusEnum(status_response.status)

        if current_status == VideoStatusEnum.RUNNING:
            await ctx.report_progress(
                progress=time.time() - start, total=args.max_wait_time
            )  # notify progress to client
            await asyncio.sleep(args.check_interval)
            continue

        if current_status == VideoStatusEnum.COMPLETED:
            await ctx.report_progress(
                progress=args.max_wait_time, total=args.max_wait_time
            )  # notify progress to client (100%)
            return VideoStatusResult(
                video_id=args.video_id,
                status=current_status,
                download_url=status_response.download_url,
            )

        if current_status == VideoStatusEnum.FAILED:
            raise RuntimeError(f"Video generation failed. Video ID: {args.video_id}")

        # Unknown status – wait and retry
        await asyncio.sleep(args.check_interval)

    raise TimeoutError("Video generation did not complete within the time limit.")


@mcp.tool(
    name="list_generated_videos",
    description="Return a paginated list of videos you have generated.",
)
async def list_generated_videos(args: ListVideosArgs) -> ListVideosResult:
    try:
        response = await nolang_api.list_videos(args.page)
        summaries = [
            VideoSummary(video_id=v.video_id, created_at=v.created_at, prompt=v.prompt or "") for v in response.results
        ]
        return ListVideosResult(
            total_videos=response.total_count,
            page=args.page,
            has_next=response.has_next,
            videos=summaries,
        )
    except httpx.HTTPStatusError as e:
        raise RuntimeError(format_http_error(e)) from e


@mcp.tool(
    name="list_video_settings",
    description="Return a paginated list of your VideoSettings.",
)
async def list_video_settings(args: ListVideoSettingsArgs) -> ListVideoSettingsResult:
    try:
        response = await nolang_api.list_video_settings(args.page)
        summaries = [
            VideoSettingSummary(
                video_setting_id=s.video_setting_id,
                title=s.title,
                updated_at=s.updated_at,
                required_fields=s.request_fields if isinstance(s.request_fields, dict) else {},
            )
            for s in response.results
        ]
        return ListVideoSettingsResult(
            total_settings=response.total_count,
            page=args.page,
            has_next=response.has_next,
            settings=summaries,
        )
    except httpx.HTTPStatusError as e:
        raise RuntimeError(format_http_error(e)) from e


@mcp.tool(
    name="recommend_templates",
    description="Recommend official templates based on video mode and optional query.",
)
async def recommend_templates(
    args: TemplateRecommendationArgs,
) -> TemplateRecommendationResult:
    try:
        response = await nolang_api.recommend_template(
            args.video_mode,
            args.query or None,
            args.is_mobile_format if args.is_mobile_format else None,
        )
        templates = [
            TemplateSummary(
                template_video_id=t.template_video_id,
                title=t.title,
                description=t.description or None,
            )
            for t in response.templates
        ]
        return TemplateRecommendationResult(templates=templates)
    except httpx.HTTPStatusError as e:
        raise RuntimeError(format_http_error(e)) from e
