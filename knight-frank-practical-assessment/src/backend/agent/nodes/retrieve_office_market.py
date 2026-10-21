"""Node: RAG retrieval from the Dubai Office Market Review index."""

from agent.models import AgentState
from agent.pinecone_client import search_index
from config import settings


def retrieve_office_market(state: AgentState) -> dict:
    query = state.get("standalone_query") or state["question"]
    context, sources = search_index(settings.office_index_name, query)
    return {"context": context, "sources": [s.model_dump() for s in sources]}