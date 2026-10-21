"""Shared Pinecone helper used by both retrieval nodes."""

from functools import lru_cache

from pinecone import Pinecone

from agent.models import Source
from config import settings

REPORT_SOURCES = {
    settings.residential_index_name: (
        "Dubai Residential Market Review Q1 2026",
        "https://www.knightfrank.ae/research/reports/dubai-residential-market-review-2365",
    ),
    settings.office_index_name: (
        "Dubai Office Market Review H2 2025",
        "https://www.knightfrank.ae/research/reports/dubai-office-market-review",
    ),
}


def _get(obj, key, default=None):
    """Read a key from either a dict-like or attribute-style SDK response object."""
    try:
        return obj[key]
    except (KeyError, TypeError, AttributeError):
        return getattr(obj, key, default)


@lru_cache
def get_pinecone() -> Pinecone:
    return Pinecone(api_key=settings.pinecone_api_key)


@lru_cache
def get_index(index_name: str):
    pc = get_pinecone()
    host = pc.describe_index(name=index_name).host
    return pc.Index(host=host)


def search_index(index_name: str, query: str) -> tuple[str, list[Source]]:
    """
    Semantic search against an index that uses integrated embedding.
    Returns (context_text_for_llm, list_of_sources).
    """
    index = get_index(index_name)
    results = index.search(
        namespace=settings.pinecone_namespace,
        query={"inputs": {"text": query}, "top_k": settings.rag_top_k},
    )
    hits = _get(_get(results, "result", {}), "hits", []) or []

    context_parts: list[str] = []
    sources: list[Source] = []
    for i, hit in enumerate(hits, start=1):
        fields = _get(hit, "fields", {}) or {}
        text = _get(fields, "chunk_text", "") or ""
        if not text:
            continue
        source_name = _get(fields, "source", index_name)
        context_parts.append(f"[{i}] (source: {source_name})\n{text}")
        display_name, source_url = REPORT_SOURCES.get(
            index_name, (str(source_name), None)
        )
        sources.append(
            Source(
                source=display_name,
                url=source_url,
                snippet=text[:200] + ("..." if len(text) > 200 else ""),
                score=_get(hit, "_score"),
            )
        )

    return "\n\n".join(context_parts), sources