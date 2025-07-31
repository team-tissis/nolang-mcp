"""Pydantic models for NoLang API data structures."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

### API CLIENT MODELS ###


class MultipartFile(BaseModel):
    """Represents one file part for multipart/form-data."""

    filename: str
    content: bytes
    mime_type: str

    def to_tuple(self) -> Tuple[str, bytes, str]:
        """Return the tuple representation expected by httpx/requests."""
        return (self.filename, self.content, self.mime_type)


FilesPayload = Dict[str, MultipartFile]


class VideoModeEnum(str, Enum):
    """Enum representing video generation modes available in NoLang."""

    QUERY_SIMPLE = "query_simple"
    QUERY_SCRIPT = "query_script"

    SLIDESHOW_PRESENTATION = "slideshow_presentation"
    SLIDESHOW_SUMMARY = "slideshow_summary"
    SLIDESHOW_ANALYSIS = "slideshow_analysis"

    AUDIO_SPEECH = "audio_speech"
    AUDIO_VIDEO = "audio_video"

    def get_required_fields(self) -> Dict[str, str]:
        """Returns required request fields for each VideoMode."""
        required_fields_map: Dict[VideoModeEnum, Dict[str, str]] = {
            VideoModeEnum.QUERY_SIMPLE: {"text": "required", "image_files": "optional"},
            VideoModeEnum.QUERY_SCRIPT: {"text": "required", "image_files": "optional"},
            VideoModeEnum.SLIDESHOW_PRESENTATION: {"pdf_file": "required"},
            VideoModeEnum.SLIDESHOW_SUMMARY: {"pdf_file": "required"},
            VideoModeEnum.SLIDESHOW_ANALYSIS: {"text": "required", "pdf_file": "required"},
            VideoModeEnum.AUDIO_SPEECH: {"audio_file": "required"},
            VideoModeEnum.AUDIO_VIDEO: {"video_file": "required"},
        }
        return required_fields_map[self]


class VideoStatusEnum(str, Enum):
    """Video generation status."""

    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class VideoGenerationRequest(BaseModel):
    """Request model for video generation."""

    model_config = ConfigDict(extra="forbid")

    setting: Union[UUID, Dict[str, Any]] = Field(..., description="Video setting ID or video setting data")
    text: Optional[str] = Field(None, description="Text prompt for query_* mode or slideshow_analysis mode")
    pdf_path: Optional[str] = Field(None, description="PDF file path for slideshow_* mode")
    pptx_path: Optional[str] = Field(None, description="PPTX file path for slideshow_* mode")
    audio_path: Optional[str] = Field(None, description="Audio file path for audio_speech mode")
    video_path: Optional[str] = Field(None, description="Video file path for audio_video mode")
    image_paths: Optional[List[str]] = Field(None, description="Image file paths for query_* mode")


class VideoGenerationResponse(BaseModel):
    """Response model for video generation."""

    model_config = ConfigDict(extra="allow")

    video_id: UUID = Field(..., description="Generated video ID")


class VideoStatusResponse(BaseModel):
    """Response model for video status."""

    model_config = ConfigDict(extra="allow")

    video_id: UUID = Field(..., description="Video ID")
    status: VideoStatusEnum = Field(..., description="Current status")
    download_url: Optional[str] = Field(None, description="Download URL when completed")
    copyright: Optional[Any] = Field(None, description="Copyright information when completed")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    prompt: Optional[str] = Field(None, description="Original prompt")


class VideoListItem(BaseModel):
    """Individual video item in list response."""

    model_config = ConfigDict(extra="allow")

    video_id: UUID = Field(..., description="Video ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    prompt: Optional[str] = Field(None, description="Original prompt")


class VideoListResponse(BaseModel):
    """Response model for video list."""

    model_config = ConfigDict(extra="allow")

    results: List[VideoListItem] = Field(..., description="List of videos")
    total_count: int = Field(..., description="Total number of videos")
    has_next: bool = Field(..., description="Whether there is a next page")


class VideoSetting(BaseModel):
    """Video setting model."""

    model_config = ConfigDict(extra="allow")

    video_setting_id: UUID = Field(..., description="Video setting ID")
    title: str = Field(..., description="Setting title")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    request_fields: Optional[Dict[str, Any]] = Field(None, description="Required request fields as dictionary")


class VideoSettingsResponse(BaseModel):
    """Response model for video settings list."""

    model_config = ConfigDict(extra="allow")

    results: List[VideoSetting] = Field(..., description="List of video settings")
    total_count: int = Field(..., description="Total number of settings")
    has_next: bool = Field(..., description="Whether there is a next page")


class Template(BaseModel):
    """Template model for recommendations."""

    model_config = ConfigDict(extra="allow")

    template_video_id: UUID = Field(..., description="Template video ID")
    title: str = Field(..., description="Template title")
    description: Optional[str] = Field(None, description="Template description")


class TemplateRecommendationResponse(BaseModel):
    """Response model for template recommendations."""

    model_config = ConfigDict(extra="allow")

    templates: List[Template] = Field(..., description="List of recommended templates")


class APIError(BaseModel):
    """API error response model."""

    model_config = ConfigDict(extra="allow")

    code: Optional[str] = Field(None, description="Error code")
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")


### MCP TOOL MODELS ###


class VideoGenerationToolArgs(BaseModel):
    """Base arguments for video generation tools."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(
        default="",
        description="Input text for query modes or slideshow_analysis mode",
    )
    pdf_path: str = Field(
        default="",
        description="PDF file path for slideshow modes",
        examples=["/path/to/presentation.pdf"],
    )
    pptx_path: str = Field(
        default="",
        description="PPTX file path for slideshow modes",
        examples=["/path/to/presentation.pptx"],
    )
    audio_path: str = Field(
        default="",
        description="Audio file path for audio_speech mode",
        examples=["/path/to/audio.mp3"],
    )
    video_path: str = Field(
        default="",
        description="Video file path for audio_video mode",
        examples=["/path/to/video.mp4"],
    )
    image_paths: str = Field(
        default="",
        description="Comma-separated image file paths for query modes",
        examples=["image1.jpg,image2.png,image3.jpeg"],
    )


class VideoGenerationFromSettingArgs(VideoGenerationToolArgs):
    """Arguments for generating video from video setting ID."""

    video_setting_id: UUID = Field(
        ...,
        description="UUID of VideoSetting to use for generation",
    )


class VideoGenerationFromVideoArgs(VideoGenerationToolArgs):
    """Arguments for generating video from existing video ID."""

    video_id: UUID = Field(
        ...,
        description="ID of existing video to use as template",
    )


class VideoStatusArgs(BaseModel):
    """Arguments for checking video status."""

    model_config = ConfigDict(extra="forbid")

    video_id: UUID = Field(
        ...,
        description="ID of the video to check status for",
    )


class VideoSettingArgs(BaseModel):
    """Arguments for retrieving video setting."""

    model_config = ConfigDict(extra="forbid")

    video_setting_id: UUID = Field(
        ...,
        description="UUID of the VideoSetting to retrieve",
    )


class TemplateRecommendationArgs(BaseModel):
    """Arguments for getting template recommendations."""

    model_config = ConfigDict(extra="forbid")

    video_mode: VideoModeEnum = Field(
        ...,
        description="Target mode for template recommendations",
    )
    query: str = Field(
        default="",
        description="User input text for template recommendations",
    )
    is_mobile_format: bool = Field(
        default=False,
        description="Set to True to target mobile format templates",
    )


class VideoWaitArgs(BaseModel):
    """Arguments for waiting for video generation completion."""

    model_config = ConfigDict(extra="forbid")

    video_id: UUID = Field(
        ...,
        description="Video ID of the generation job",
    )
    max_wait_time: int = Field(
        default=600,
        description="Maximum seconds to wait for generation completion",
        ge=1,
        le=3600,
    )
    check_interval: int = Field(default=10, description="Interval (seconds) to check status", ge=1, le=60)


class ListVideosArgs(BaseModel):
    """Arguments for listing videos."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, description="Page number to retrieve", ge=1)


class ListVideoSettingsArgs(BaseModel):
    """Arguments for listing video settings."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, description="Page number to retrieve", ge=1)


### MCP TOOL RESULT MODELS ###


class VideoGenerationResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    video_id: UUID = Field(..., description="Unique identifier for the queued video")


class VideoStatusResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    video_id: UUID = Field(..., description="Unique identifier for the video")
    status: VideoStatusEnum = Field(..., description="Current status of the video")
    download_url: Optional[str] = Field(None, description="Signed URL for the finished MP4 file")


class VideoSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    video_id: UUID = Field(..., description="Unique identifier for the video")
    created_at: datetime = Field(..., description="Creation timestamp of the video")
    prompt: Optional[str] = Field(None, description="Original prompt used to generate the video")


class ListVideosResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    total_videos: int = Field(..., description="Total number of videos matching the criteria")
    page: int = Field(..., description="Current page number")
    has_next: bool = Field(..., description="True if there is another page of results")
    videos: List[VideoSummary] = Field(..., description="List of video summaries")


class VideoSettingSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    video_setting_id: UUID = Field(..., description="Unique identifier for the video setting")
    title: str = Field(..., description="Title of the video setting")
    updated_at: datetime = Field(..., description="Last updated timestamp for the setting")
    required_fields: Dict[str, Any] = Field(..., description="Dictionary of required request fields for this setting")


class ListVideoSettingsResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    total_settings: int = Field(..., description="Total number of video settings")
    page: int = Field(..., description="Current page number")
    has_next: bool = Field(..., description="True if there is another page of results")
    settings: List[VideoSettingSummary] = Field(..., description="List of video setting summaries")


class TemplateSummary(BaseModel):
    model_config = ConfigDict(extra="allow")

    template_video_id: UUID = Field(..., description="Unique identifier for the template video")
    title: str = Field(..., description="Title of the template video")
    description: Optional[str] = Field(None, description="Description of the template video")


class TemplateRecommendationResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    templates: List[TemplateSummary] = Field(..., description="List of recommended template summaries")
