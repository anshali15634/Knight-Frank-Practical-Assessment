"""
LangGraph definition.

            +-------------------+
 START ---> |  classify_intent  |
            +---------+---------+
                      |
   +------------+-----+-------+------------------+
   |            |             |                  |
 residential  office     press_releases   off_topic / contact /
 retrieval    retrieval  (Firecrawl)      property_search
   |            |             |                  |
   +------------+------+------+------------------+
                       v
               generate_response ---> END
"""

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from agent.models import AgentState, Intent
from agent.nodes.classify_intent import classify_intent
from agent.nodes.fetch_press_releases import fetch_press_releases
from agent.nodes.generate_response import generate_response
from agent.nodes.retrieve_office_market import retrieve_office_market
from agent.nodes.retrieve_residential_market import retrieve_residential_market


def route_after_classification(state: AgentState) -> str:
    """Pick the next node based on the classified intent."""
    return {
        Intent.RESIDENTIAL_MARKET.value: "retrieve_residential_market",
        Intent.OFFICE_MARKET.value: "retrieve_office_market",
        Intent.PRESS_RELEASES.value: "fetch_press_releases",
    }.get(state["intent"], "generate_response")  # off_topic, contact, property_search


def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("classify_intent", classify_intent)
    builder.add_node("retrieve_residential_market", retrieve_residential_market)
    builder.add_node("retrieve_office_market", retrieve_office_market)
    builder.add_node("fetch_press_releases", fetch_press_releases)
    builder.add_node("generate_response", generate_response)

    builder.add_edge(START, "classify_intent")
    builder.add_conditional_edges(
        "classify_intent",
        route_after_classification,
        [
            "retrieve_residential_market",
            "retrieve_office_market",
            "fetch_press_releases",
            "generate_response",
        ],
    )
    for node in ("retrieve_residential_market", "retrieve_office_market", "fetch_press_releases"):
        builder.add_edge(node, "generate_response")
    builder.add_edge("generate_response", END)

    # In-memory conversation memory keyed by thread_id (= session_id).
    # Swap for SqliteSaver / PostgresSaver when you need persistence across restarts.
    return builder.compile(checkpointer=MemorySaver())


agent_graph = build_graph()