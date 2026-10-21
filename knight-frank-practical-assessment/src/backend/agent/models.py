"""Pydantic models (API + structured LLM output) and the LangGraph state."""

import operator
from enum import Enum
from typing import Annotated, TypedDict

from pydantic import BaseModel, Field


# ----------------------------------------------------------------- intents --
class Intent(str, Enum):
    OFF_TOPIC = "off_topic"
    CONTACT = "contact"
    RESIDENTIAL_MARKET = "residential_market"
    OFFICE_MARKET = "office_market"
    PRESS_RELEASES = "press_releases"
    PROPERTY_SEARCH = "property_search"  # placeholder - to be implemented later


class IntentClassification(BaseModel):
    """Structured output returned by Gemini in the classify_intent node."""

    intent: Intent = Field(description="The single best-matching intent for the latest user message.")
    standalone_query: str = Field(
        description=(
            "The user's latest message rewritten as a self-contained question, resolving any "
            "references to earlier turns (e.g. 'what about Q3?' -> 'What were Dubai residential "
            "sales in Q3 2025?'). If already self-contained, repeat it unchanged."
        )
    )
    reasoning: str = Field(description="One short sentence explaining the choice.")


# --------------------------------------------------------------------- API --
class Source(BaseModel):
    source: str = Field(description="Document name or article title.")
    snippet: str | None = Field(default=None, description="Short excerpt used as evidence.")
    url: str | None = None
    score: float | None = Field(default=None, description="Vector similarity score (RAG only).")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, examples=["How did Dubai villa prices perform last year?"])
    session_id: str | None = Field(
        default=None,
        description="Reuse the session_id from a previous response to keep conversation memory.",
    )


class ChatResponse(BaseModel):
    session_id: str
    intent: Intent
    answer: str
    sources: list[Source] = Field(default_factory=list)


# ------------------------------------------------------------- graph state --
class AgentState(TypedDict, total=False):
    question: str                                   # raw user message
    standalone_query: str                           # rewritten for retrieval
    intent: str                                     # Intent value
    context: str                                    # retrieved / scraped text for the LLM
    sources: list[dict]                             # Source.model_dump() items
    answer: str
    history: Annotated[list[dict], operator.add]    # [{"role": "user"|"assistant", "content": str}]