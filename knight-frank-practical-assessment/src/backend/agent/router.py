"""FastAPI router exposing the LangGraph agent (mounted from main.py)."""

import json
import logging
import uuid
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from agent.graph import agent_graph
from agent.models import ChatRequest, ChatResponse, Intent, Source
from properties.schemas import PropertySummary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Agent"])


def _stream_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _progress_for_intent(intent: str) -> str:
    if intent == Intent.OFFICE_MARKET.value:
        return "Looking through Knight Frank's biannual Office Market Report..."
    if intent == Intent.RESIDENTIAL_MARKET.value:
        return "Looking through Knight Frank's Residential Market Review..."
    if intent == Intent.PRESS_RELEASES.value:
        return "Checking the latest Knight Frank newsroom announcements..."
    if intent == Intent.PROPERTY_SEARCH.value:
        return "Searching Knight Frank property listings..."
    return "Generating your response..."


def _chat_events(request: ChatRequest, session_id: str) -> Iterator[str]:
    yield _stream_event(
        "progress",
        {"stage": "analyzing", "message": "Reviewing your question..."},
    )
    result: dict = {}
    try:
        updates = agent_graph.stream(
            {"question": request.message},
            config={"configurable": {"thread_id": session_id}},
            stream_mode="updates",
        )
        for update in updates:
            for node_name, node_result in update.items():
                result.update(node_result)
                if node_name == "classify_intent":
                    intent = result["intent"]
                    stage = (
                        "research"
                        if intent
                        in {
                            Intent.OFFICE_MARKET.value,
                            Intent.RESIDENTIAL_MARKET.value,
                            Intent.PRESS_RELEASES.value,
                            Intent.PROPERTY_SEARCH.value,
                        }
                        else "generating"
                    )
                    yield _stream_event(
                        "progress",
                        {
                            "stage": stage,
                            "message": _progress_for_intent(intent),
                        },
                    )
                elif node_name in {
                    "retrieve_office_market",
                    "retrieve_residential_market",
                    "fetch_press_releases",
                }:
                    yield _stream_event(
                        "progress",
                        {
                            "stage": "generating",
                            "message": "Generating your response...",
                        },
                    )
                elif node_name == "search_properties":
                    yield _stream_event("complete", {
                        "session_id": session_id,
                        "intent": result["intent"],
                        "answer": result["answer"],
                        "sources": [],
                        "properties": result.get("properties", []),
                    })
                    return
                elif node_name == "generate_response":
                    yield _stream_event("complete", {
                        "session_id": session_id,
                        "intent": result["intent"],
                        "answer": result["answer"],
                        "sources": result.get("sources", []),
                    })
                    return
    except Exception:
        logger.exception("Agent streaming failure")
        yield _stream_event(
            "error",
            {"message": "Frank couldn't complete that request. Please try again."},
        )
        return

    logger.error("Agent stream ended without an answer")
    yield _stream_event(
        "error",
        {"message": "Frank couldn't complete that request. Please try again."},
    )


@router.post("/chat/stream")
def stream_chat(request: ChatRequest) -> StreamingResponse:
    """Stream agent progress updates and the completed response as server-sent events."""
    session_id = request.session_id or str(uuid.uuid4())
    return StreamingResponse(
        _chat_events(request, session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """Send a message to the agent. Reuse `session_id` from the response to continue a conversation."""
    session_id = request.session_id or str(uuid.uuid4())
    try:
        result = agent_graph.invoke(
            {"question": request.message},
            config={"configurable": {"thread_id": session_id}},
        )
    except Exception as exc:
        logger.exception("Agent failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The assistant ran into a problem. Please try again.",
        ) from exc

    return ChatResponse(
        session_id=session_id,
        intent=Intent(result["intent"]),
        answer=result["answer"],
        sources=[Source(**s) for s in result.get("sources", [])],
        properties=[PropertySummary(**p) for p in result.get("properties", [])],
    )