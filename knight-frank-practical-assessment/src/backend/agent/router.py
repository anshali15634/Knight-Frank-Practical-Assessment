"""FastAPI router exposing the LangGraph agent (mounted from main.py)."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, status

from agent.graph import agent_graph
from agent.models import ChatRequest, ChatResponse, Intent, Source

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Agent"])


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
    )