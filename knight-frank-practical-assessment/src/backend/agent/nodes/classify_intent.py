"""Node 1: classify the user's message into an intent (and rewrite it for retrieval)."""

from agent.gemini_client import generate_structured
from agent.models import AgentState, IntentClassification

SYSTEM_PROMPT = """You are the intent router for a Knight Frank Dubai real-estate assistant.
Classify the user's LATEST message into exactly one intent:

- residential_market: questions about Knight Frank's Dubai Residential Market Review
  (prices, sales volumes, transactions, rents, supply, prime/luxury segment, areas, forecasts).
- office_market: questions about Knight Frank's Dubai Office Market Review
  (office rents, occupancy, vacancy, leasing activity, supply, values, investment, Grade A, districts).
- press_releases: asks for the latest news, press releases or announcements from the Knight Frank
  newsroom, or asks to summarise them.
- contact: wants to speak to someone, get in touch, request a callback, book a viewing/valuation/
  consultation, or has further enquiries that need a human from the team.
- property_search: wants to find, browse or list specific properties for sale or rent.
- off_topic: anything else (unrelated subjects, general chit-chat, greetings, coding help, other
  cities' market reviews, etc.).

Use the conversation history to resolve follow-ups. Also rewrite the latest message as a
self-contained question (standalone_query)."""


def _format_history(history: list[dict], max_messages: int = 6) -> str:
    if not history:
        return "(no previous messages)"
    return "\n".join(f"{m['role']}: {m['content']}" for m in history[-max_messages:])


def classify_intent(state: AgentState) -> dict:
    question = state["question"]
    prompt = (
        f"Conversation history:\n{_format_history(state.get('history', []))}\n\n"
        f"Latest user message:\n{question}"
    )
    result = generate_structured(prompt, IntentClassification, system_instruction=SYSTEM_PROMPT)

    # Reset per-turn fields so nothing stale leaks in from a previous turn in the same session.
    return {
        "intent": result.intent.value,
        "standalone_query": result.standalone_query or question,
        "context": "",
        "sources": [],
        "answer": "",
    }