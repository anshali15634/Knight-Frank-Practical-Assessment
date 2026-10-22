"""Node 1: classify the user's message into an intent."""

from agent.gemini_client import generate_structured
from agent.models import AgentState, IntentClassification

SYSTEM_PROMPT = """You classify requests for Knight Frank's real-estate assistant.
Choose exactly one intent for the latest user message:

- property_search: the user wants to find or browse individual property listings or assets, or asks
  for properties matching any listing criteria. Criteria include asset class (such as retail or
  hotels), region/country/city (including Africa), yield, price, rent, size, tenure or property
  type. This includes phrasing like "Show me African retail properties yielding at least 4%" even
  without the words "for sale" or "for rent". Do not classify listing searches as market reports.
- residential_market: questions about Knight Frank's Dubai Residential Market Review, its market
  trends, prices, sales volumes, transactions, rents, supply, prime/luxury segment, areas or forecasts.
- office_market: questions about Knight Frank's Dubai Office Market Review and its market trends,
  office rents, occupancy, vacancy, leasing activity, supply, values, Grade A or districts.
- press_releases: asks for the latest news, press releases or announcements from the Knight Frank
  newsroom, or asks to summarise them.
- contact: wants to speak to someone, get in touch, request a callback, book a viewing/valuation/
  consultation, or has further enquiries that need a human from the team.
- off_topic: unrelated subjects, general chit-chat, greetings, coding help or requests outside
  Knight Frank property listings, the specified Dubai market reviews, press releases and contact.

Use the short conversation history only to resolve an elliptical follow-up. Return only the intent;
do not rewrite the user's message or provide reasoning."""


def _format_history(history: list[dict], max_messages: int = 2) -> str:
    if not history:
        return "(no previous messages)"
    return "\n".join(f"{m['role']}: {m['content']}" for m in history[-max_messages:])


def classify_intent(state: AgentState) -> dict:
    question = state["question"]
    prompt = (
        f"Recent conversation (last two messages):\n{_format_history(state.get('history', []))}\n\n"
        f"Latest user message:\n{question}"
    )
    result = generate_structured(prompt, IntentClassification, system_instruction=SYSTEM_PROMPT)

    # Reset per-turn fields so nothing stale leaks in from a previous turn in the same session.
    return {
        "intent": result.intent.value,
        "context": "",
        "sources": [],
        "properties": [],
        "answer": "",
    }