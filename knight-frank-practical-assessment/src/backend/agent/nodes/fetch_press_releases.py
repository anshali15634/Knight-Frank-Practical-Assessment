"""
Node: crawl the Knight Frank UAE newsroom with Firecrawl.

1. Scrape the press-release listing page (newest first).
2. Parse the latest N article links (/newsroom/article/YYYY/M/slug).
3. Scrape each article in parallel.
4. Hand the combined text to generate_response, which asks Gemini to summarise it.

Results are cached in-memory for a while to save Firecrawl credits.
"""

import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

from firecrawl import Firecrawl

from agent.models import AgentState, Source
from config import settings

logger = logging.getLogger(__name__)

LINK_RE = re.compile(
    r"\[([^\]]+)\]\((https://www\.knightfrank\.ae/newsroom/article/[^)\s]+)[^)]*\)"
)
DATE_RE = re.compile(
    r"\b\d{1,2} (?:January|February|March|April|May|June|July|August|September|"
    r"October|November|December) \d{4}\b"
)

_cache: dict = {"ts": 0.0, "data": None}
_cache_lock = threading.Lock()


@lru_cache
def _firecrawl() -> Firecrawl:
    return Firecrawl(api_key=settings.firecrawl_api_key)


def _scrape_markdown(url: str) -> str:
    client = _firecrawl()
    scrape = getattr(client, "scrape", None) or getattr(client, "scrape_url")  # SDK version safety
    doc = scrape(url, formats=["markdown"], only_main_content=True)
    markdown = doc.get("markdown") if isinstance(doc, dict) else getattr(doc, "markdown", None)
    return markdown or ""


def _parse_listing(markdown: str, limit: int) -> list[dict]:
    """Extract (title, url, date) for the newest `limit` articles from the listing markdown."""
    matches = list(LINK_RE.finditer(markdown))
    items, seen = [], set()
    for idx, m in enumerate(matches):
        url = m.group(2)
        if url in seen:
            continue
        seen.add(url)
        window_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(markdown)
        date_match = DATE_RE.search(markdown[m.end():window_end])
        items.append({"title": m.group(1).strip(), "url": url, "date": date_match.group(0) if date_match else None})
        if len(items) >= limit:
            break
    return items


def _scrape_article(item: dict) -> dict:
    try:
        text = _scrape_markdown(item["url"])
    except Exception as exc:  # keep going if one article fails
        logger.warning("Failed to scrape %s: %s", item["url"], exc)
        text = ""
    return {**item, "text": text[: settings.press_article_max_chars]}


def _crawl_latest() -> list[dict]:
    listing = _scrape_markdown(settings.press_release_url)
    items = _parse_listing(listing, settings.press_release_count)
    if not items:
        # Fallback: give Gemini the raw listing page.
        return [{"title": "Press releases listing", "url": settings.press_release_url, "date": None,
                 "text": listing[: settings.press_article_max_chars * 2]}]
    with ThreadPoolExecutor(max_workers=len(items)) as pool:
        return list(pool.map(_scrape_article, items))


def _get_articles() -> list[dict]:
    with _cache_lock:
        if _cache["data"] and time.time() - _cache["ts"] < settings.press_cache_ttl_seconds:
            return _cache["data"]
    articles = _crawl_latest()
    with _cache_lock:
        _cache.update(ts=time.time(), data=articles)
    return articles


def fetch_press_releases(state: AgentState) -> dict:
    try:
        articles = _get_articles()
    except Exception as exc:
        logger.exception("Firecrawl failure: %s", exc)
        return {"context": "", "sources": []}

    context = "\n\n---\n\n".join(
        f"ARTICLE {i}\nTitle: {a['title']}\nDate: {a['date'] or 'unknown'}\nURL: {a['url']}\n\n"
        f"{a['text'] or '(full text unavailable)'}"
        for i, a in enumerate(articles, start=1)
    )
    sources = [
        Source(source=a["title"], url=a["url"], snippet=a["date"]).model_dump() for a in articles
    ]
    return {"context": context, "sources": sources}