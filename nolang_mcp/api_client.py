import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

import httpx
from pydantic import FilePath, TypeAdapter, ValidationError

from nolang_mcp.config import nolang_mcp_config
from nolang_mcp.models import (
    FilesPayload,
    MultipartFile,
    TemplateRecommendationResponse,
    VideoGenerationResponse,
    VideoListResponse,
    VideoModeEnum,
    VideoSettingsResponse,
    VideoStatusResponse,
)


class NoLangAPI:
    def __init__(self, api_key: str) -> None:
        self.base_url = nolang_mcp_config.nolang_api_base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}

    @staticmethod
    def _validate_file_path(file_path: str) -> Path:
        """Validate that the given file path exists and return Path instance."""
        try:
            TypeAdapter(FilePath).validate_python(file_path)
            return Path(file_path)
        except ValidationError:
            raise FileNotFoundError(f"File not found: {file_path}")

    async def _post(
        self,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        files: Optional[FilesPayload] = None,
    ) -> Dict[str, Any]:
        files_to_send = {k: v.to_tuple() for k, v in files.items()} if files else None

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            url = f"{self.base_url}{path}"

            if data and "setting" in data and isinstance(data["setting"], dict):
                data = {**data, "setting": json.dumps(data["setting"], ensure_ascii=False)}
            r = await client.post(url, headers=self.headers, data=data, files=files_to_send)
            r.raise_for_status()
            return r.json()

    async def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}{path}"
            r = await client.get(url, headers=self.headers, params=params)

            r.raise_for_status()
            try:
                return r.json()
            except Exception:
                raise

    def _prepare_setting_data(self, setting: Union[UUID, str, Dict[str, Any]]) -> tuple[str, Dict[str, Any]]:
        """Internal utility: returns API URL and data base from setting"""
        if isinstance(setting, dict):
            return "/unstable/videos/generate/", {"setting": setting}
        else:
            return "/videos/generate/", {"video_setting_id": str(setting)}

    async def _generate_video_with_file(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        file_path: str,
        file_field_name: str,
        mime_type: str,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> VideoGenerationResponse:
        path = self._validate_file_path(file_path)

        api_url, data = self._prepare_setting_data(setting)
        if extra_data:
            data.update(extra_data)

        with open(path, "rb") as f:
            files: FilesPayload = {
                file_field_name: MultipartFile(filename=path.name, content=f.read(), mime_type=mime_type)
            }

        response_data = await self._post(api_url, data=data, files=files)
        return VideoGenerationResponse(**response_data)

    async def generate_video_with_text(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        text: str,
        image_files: Optional[List[str]] = None,
    ) -> VideoGenerationResponse:
        api_url, data = self._prepare_setting_data(setting)
        data["text"] = text

        files: FilesPayload = {}

        if image_files:
            for image_path in image_files:
                try:
                    path = self._validate_file_path(image_path)
                except FileNotFoundError:
                    # Skip non-existent image paths gracefully
                    continue

                with open(path, "rb") as f:
                    files["image_files"] = MultipartFile(
                        filename=path.name,
                        content=f.read(),
                        mime_type="image/jpeg",
                    )

        if files:
            response_data = await self._post(api_url, data=data, files=files)
        else:
            response_data = await self._post(api_url, data=data)

        return VideoGenerationResponse(**response_data)

    async def generate_video_with_pdf(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        pdf_path: str,
    ) -> VideoGenerationResponse:
        """Generate video by uploading PDF"""
        return await self._generate_video_with_file(
            setting,
            pdf_path,
            "pdf_file",
            "application/pdf",
        )

    async def generate_video_with_pptx(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        pptx_path: str,
    ) -> VideoGenerationResponse:
        """Generate video by uploading PPTX"""
        return await self._generate_video_with_file(
            setting,
            pptx_path,
            "pptx_file",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )

    async def generate_video_with_audio(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        audio_path: str,
    ) -> VideoGenerationResponse:
        """Generate video by uploading audio file"""
        path = self._validate_file_path(audio_path)

        mime_types = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
        }
        mime_type = mime_types.get(path.suffix.lower(), "audio/mpeg")

        return await self._generate_video_with_file(
            setting,
            audio_path,
            "audio_file",
            mime_type,
        )

    async def generate_video_with_video(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        video_path: str,
    ) -> VideoGenerationResponse:
        """Generate video by uploading video file (encoding only)"""
        return await self._generate_video_with_file(
            setting,
            video_path,
            "video_file",
            "video/mp4",
        )

    async def generate_video_with_pdf_and_text(
        self,
        setting: Union[UUID, str, Dict[str, Any]],
        pdf_path: str,
        text: str,
    ) -> VideoGenerationResponse:
        """Generate video with combination of PDF and text"""
        return await self._generate_video_with_file(
            setting,
            pdf_path,
            "pdf_file",
            "application/pdf",
            extra_data={"text": text},
        )

    async def get_video_status(self, video_id: UUID) -> VideoStatusResponse:
        response_data = await self._get(f"/videos/{video_id}/")
        return VideoStatusResponse(**response_data)

    async def list_videos(self, page: int = 1) -> VideoListResponse:
        response_data = await self._get("/videos/", params={"page": page})
        return VideoListResponse(**response_data)

    async def list_video_settings(self, page: int = 1) -> VideoSettingsResponse:
        response_data = await self._get("/unstable/video-settings/", params={"page": page})
        return VideoSettingsResponse(**response_data)

    async def get_video_setting_from_video_id(self, video_id: UUID) -> Dict[str, Any]:
        return await self._get(
            f"/unstable/video-settings/{video_id}/",
        )

    async def recommend_template(
        self,
        video_mode: VideoModeEnum,
        query: Optional[str] = None,
        is_mobile_format: Optional[bool] = None,
    ) -> TemplateRecommendationResponse:
        """Template recommendation endpoint (unstable)"""
        params: Dict[str, Any] = {"video_mode": video_mode.value}
        if query is not None:
            params["query"] = query
        if is_mobile_format is not None:
            params["is_mobile_format"] = is_mobile_format

        try:
            response_data = await self._get(
                "/unstable/template/recommend/",
                params=params,
            )
            return TemplateRecommendationResponse(**response_data)
        except Exception:
            raise


def format_http_error(e: httpx.HTTPStatusError) -> str:
    try:
        data = e.response.json()
        return (
            f"API Error {e.response.status_code}\n"
            f"Code   : {data.get('code', '—')}\n"
            f"Message: {data.get('error', 'Unknown error')}"
        )
    except Exception:
        return f"API Error {e.response.status_code}\nBody: {e.response.text}"


nolang_api = NoLangAPI(nolang_mcp_config.nolang_api_key)
