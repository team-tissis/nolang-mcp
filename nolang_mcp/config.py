from pydantic_settings import BaseSettings


class NoLangMCPConfig(BaseSettings):
    """
    Settings can be set by:
    - OS Environment Variables
        NOLANG_API_KEY: NoLang API key
        NOLANG_API_BASE_URL: NoLang API base URL
        NOLANG_MCP_PORT: NoLang MCP port
    """

    nolang_api_key: str
    nolang_api_base_url: str = "https://api.no-lang.com/v1"
    nolang_mcp_port: int = 7310

    class Config:  # type: ignore[override]
        case_sensitive = False
        env_prefix = ""


nolang_mcp_config = NoLangMCPConfig()  # type: ignore[call-arg]
