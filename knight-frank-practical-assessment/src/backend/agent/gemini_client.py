"""Thin wrapper around the Google Gen AI SDK (google-genai)."""

from functools import lru_cache
from threading import Lock
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from config import settings

T = TypeVar("T", bound=BaseModel)

_key_index = 0
_key_index_lock = Lock()


def _api_keys() -> tuple[str, ...]:
    return tuple(
        key
        for key in (
            settings.google_api_key,
            settings.google_api_key1,
            settings.google_api_key2,
            settings.google_api_key3,
            settings.google_api_key4,
        )
        if key
    )


@lru_cache
def _get_client_for_key(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def get_client() -> genai.Client:
    keys = _api_keys()
    if not keys:
        raise RuntimeError("No Gemini API keys are configured.")
    with _key_index_lock:
        return _get_client_for_key(keys[_key_index % len(keys)])


def _is_quota_error(error: Exception) -> bool:
    return (
        getattr(error, "code", None) == 429
        or getattr(error, "status_code", None) == 429
    )


def _generate_content(
    prompt: str, config: types.GenerateContentConfig
) -> types.GenerateContentResponse:
    global _key_index

    keys = _api_keys()
    if not keys:
        raise RuntimeError("No Gemini API keys are configured.")
    with _key_index_lock:
        start_index = _key_index % len(keys)

    for offset in range(len(keys)):
        index = (start_index + offset) % len(keys)
        try:
            return _get_client_for_key(keys[index]).models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=config,
            )
        except Exception as error:
            if not _is_quota_error(error):
                raise
            with _key_index_lock:
                if _key_index % len(keys) == index:
                    _key_index = (index + 1) % len(keys)
            if offset == len(keys) - 1:
                raise

    raise RuntimeError("No Gemini API keys are configured.")


def generate_text(
    prompt: str,
    *,
    system_instruction: str | None = None,
    temperature: float = 0.2,
) -> str:
    """Plain text generation."""
    response = _generate_content(
        prompt,
        types.GenerateContentConfig(
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True
            ),
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
    response = _generate_content(
        prompt,
        types.GenerateContentConfig(
            automatic_function_calling=types.AutomaticFunctionCallingConfig(
                disable=True
            ),
            system_instruction=system_instruction,
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=schema,
        ),
    )
    if isinstance(response.parsed, schema):
        return response.parsed
    return schema.model_validate_json(response.text)