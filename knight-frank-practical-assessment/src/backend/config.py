"""Central configuration, loaded from environment variables / a .env file."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore"
    )

    # --- API keys ---
    google_api_key: str
    pinecone_api_key: str
    firecrawl_api_key: str

    # --- Gemini ---
    gemini_model: str = "gemini-2.5-flash"

    # --- Pinecone (names must match the indexes created by your ingestion script) ---
    residential_index_name: str = "residential-index"
    office_index_name: str = "office-market-index"
    pinecone_namespace: str = "__default__"
    rag_top_k: int = 3

    # --- Firecrawl / press releases ---
    press_release_url: str = "https://www.knightfrank.ae/newsroom/press-release"
    press_release_count: int = 3            # how many latest articles to scrape & summarise
    press_article_max_chars: int = 6000     # per-article truncation before sending to Gemini
    press_cache_ttl_seconds: int = 1800     # cache scraped results to save Firecrawl credits

    # --- Automated responses ---
    contact_url: str = "https://www.knightfrank.ae/contact-us"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()