"""Pydantic models (API + structured LLM output) and the LangGraph state."""

import operator
from enum import Enum
from typing import Annotated, TypedDict

from pydantic import BaseModel, Field

from properties.schemas import PropertySummary, Range


# ----------------------------------------------------------------- intents --
class Intent(str, Enum):
    OFF_TOPIC = "off_topic"
    CONTACT = "contact"
    RESIDENTIAL_MARKET = "residential_market"
    OFFICE_MARKET = "office_market"
    PRESS_RELEASES = "press_releases"
    PROPERTY_SEARCH = "property_search"


class IntentClassification(BaseModel):
    """Structured output returned by Gemini in the classify_intent node."""

    intent: Intent = Field(description="The single best-matching intent for the latest user message.")


class PropertySearchExtraction(BaseModel):
    """Property-table filters extracted from a natural-language search request."""

    property_name: str | None = Field(None, description="Property name mentioned by the user.")
    city: str | None = Field(None, description="City mentioned by the user.")
    country: str | None = Field(None, description="Country mentioned by the user.")
    region: str | None = Field(None, description="Region, using the canonical property region when possible.")
    asset_class: str | None = Field(None, description="Asset class, e.g. Hotels, Offices or Retail.")
    property_type: str | None = Field(None, description="Commercial or Residential.")
    tenure: str | None = Field(None, description="Tenure mentioned by the user.")
    currency: str | None = Field(None, description="Three-letter currency for price or rent amounts.")
    price_guide_price: Range | None = Field(
        None, description="Price / guide-price bounds as numeric amounts in the requested currency."
    )
    niy_yield: Range | None = Field(
        None, description="Net initial yield bounds as percentages, e.g. above 6.5% means min 6.5."
    )
    price_psf: Range | None = Field(None, description="Price-per-square-foot bounds.")
    size: Range | None = Field(None, description="Size bounds normalized to square feet.")
    rent_income_pa: Range | None = Field(None, description="Annual rental-income bounds in the requested currency.")
    rent_psf: Range | None = Field(None, description="Rent-per-square-foot bounds.")


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
    properties: list[PropertySummary] = Field(default_factory=list)


# ------------------------------------------------------------- graph state --
class AgentState(TypedDict, total=False):
    question: str                                   # raw user message
    intent: str                                     # Intent value
    context: str                                    # retrieved / scraped text for the LLM
    sources: list[dict]                             # Source.model_dump() items
    properties: list[dict]                          # Property search results
    answer: str
    history: Annotated[list[dict], operator.add]    # [{"role": "user"|"assistant", "content": str}]