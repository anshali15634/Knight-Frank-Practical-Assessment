"""Thin wrapper around the Google Gen AI SDK (google-genai)."""

from functools import lru_cache
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from config import settings

T = TypeVar("T", bound=BaseModel)


@lru_cache
def get_client() -> genai.Client:
    return genai.Client(api_key=settings.google_api_key)


def generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    temperature: float = 0.2,
) -> str:
    """Plain text generation."""
    response = get_client().models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )
    return (response.text or "").strip()


def generate_structured(
    prompt: str,
    schema: type[T],
    *,
    system_instruction: str | None = None,
    temperature: float = 0.0,
) -> T:
    """Generation constrained to a Pydantic schema (JSON mode)."""
    response = get_client().models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=schema,
        ),
    )
    if isinstance(response.parsed, schema):
        return response.parsed
    return schema.model_validate_json(response.text)