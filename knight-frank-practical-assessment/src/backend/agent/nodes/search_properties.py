"""Node: extract property filters with Gemini and query the property search service."""

from agent.gemini_client import generate_structured
from agent.models import AgentState, PropertySearchExtraction
from properties import services
from properties.schemas import Range, SearchFilters, SortField, SortOrder

SYSTEM_PROMPT = """Extract only filters explicitly stated or clearly implied in the user's property
search question. Return null for text filters that are not mentioned and null ranges for numeric
criteria that are not mentioned. For ranges, put "above"/"over"/"more than" values in min and
"below"/"under"/"less than" values in max; preserve the requested boundary. Convert amounts such as
"500 million" to 500000000 in the stated currency. Keep yield values as percentages (6.5%, not
0.065), normalize sizes to square feet, and use three-letter ISO currency codes. If a price or rent
amount is given without a currency, use AED. Use canonical region and asset-class values where
possible. Do not invent filters or property facts."""


def search_properties(state: AgentState) -> dict:
    question = state["question"]
    extracted = generate_structured(
        question,
        PropertySearchExtraction,
        system_instruction=SYSTEM_PROMPT,
    )

    filters = SearchFilters(
        property_name=extracted.property_name,
        city=extracted.city,
        country=extracted.country,
        region=extracted.region,
        asset_class=extracted.asset_class,
        property_type=extracted.property_type,
        tenure=extracted.tenure,
        currency=extracted.currency,
        price=extracted.price_guide_price or Range(),
        net_initial_yield=extracted.niy_yield or Range(),
        price_psf=extracted.price_psf or Range(),
        size_sqft=extracted.size or Range(),
        rent_per_annum=extracted.rent_income_pa or Range(),
        rent_psf=extracted.rent_psf or Range(),
    )
    result = services.search_properties(
        filters,
        page=1,
        page_size=3,
        sort_by=SortField.name,
        sort_order=SortOrder.asc,
    )
    properties = [item.model_dump() for item in result.items]
    answer = (
        "You can find these properties in detail in our 'Find Properties' section."
        if properties
        else "No properties were found with that description."
    )
    return {
        "properties": properties,
        "answer": answer,
        "history": [
            {"role": "user", "content": state["question"]},
            {"role": "assistant", "content": answer},
        ],
    }
