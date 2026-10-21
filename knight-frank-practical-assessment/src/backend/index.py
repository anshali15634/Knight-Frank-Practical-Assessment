"""
Upsert unstructured text files into Pinecone vector indexes.

Each .txt file -> its own index, using Pinecone's integrated embedding
(text is embedded server-side, so no OpenAI/other embedding key is needed).

Setup:
    pip install pinecone
    export PINECONE_API_KEY="your-key"      # or paste into API_KEY below
    python pinecone_upsert.py
"""

import os
import re
import time
from pathlib import Path

from pinecone import Pinecone

# ---------------------------------------------------------------- config ----
API_KEY = os.environ.get("PINECONE_API_KEY", "")

CLOUD = "aws"
REGION = "us-east-1"
EMBED_MODEL = "llama-text-embed-v2"  # Pinecone-hosted embedding model
NAMESPACE = "__default__"

# file path -> index name (index names: lowercase letters, numbers, hyphens)
FILES_TO_INDEXES = {
    "residential_market_review_KF.txt": "residential-index",
    "office_market_kf_review.txt": "office-market-index",
}

CHUNK_SIZE = 1000      # max characters per chunk
CHUNK_OVERLAP = 150    # characters carried over between chunks
BATCH_SIZE = 96        # Pinecone limit for text upserts with integrated embedding


# --------------------------------------------------------------- chunking ---
def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    """Split text into chunks, preferring paragraph, then sentence boundaries."""
    text = re.sub(r"\r\n?", "\n", text).strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

    # Break any oversized paragraph into sentences / hard slices
    pieces = []
    for para in paragraphs:
        if len(para) <= chunk_size:
            pieces.append(para)
            continue
        sentences = re.split(r"(?<=[.!?])\s+", para)
        buf = ""
        for s in sentences:
            while len(s) > chunk_size:  # very long sentence: hard split
                if buf:
                    pieces.append(buf)
                    buf = ""
                pieces.append(s[:chunk_size])
                s = s[chunk_size:]
            if len(buf) + len(s) + 1 <= chunk_size:
                buf = f"{buf} {s}".strip()
            else:
                pieces.append(buf)
                buf = s
        if buf:
            pieces.append(buf)

    # Merge small pieces into chunks up to chunk_size, with overlap
    chunks, current = [], ""
    for piece in pieces:
        if current and len(current) + len(piece) + 2 > chunk_size:
            chunks.append(current)
            tail = current[-overlap:] if overlap else ""
            current = f"{tail}\n\n{piece}".strip() if tail else piece
        else:
            current = f"{current}\n\n{piece}".strip() if current else piece
    if current:
        chunks.append(current)
    return chunks


# --------------------------------------------------------------- pinecone ---
def get_or_create_index(pc: Pinecone, name: str):
    if not pc.has_index(name):
        print(f"Creating index '{name}'...")
        pc.create_index_for_model(
            name=name,
            cloud=CLOUD,
            region=REGION,
            embed={
                "model": EMBED_MODEL,
                # maps the record field "chunk_text" to the text to embed
                "field_map": {"text": "chunk_text"},
            },
        )
    else:
        print(f"Index '{name}' already exists.")

    while not pc.describe_index(name=name).status["ready"]:
        time.sleep(2)
    host = pc.describe_index(name=name).host
    return pc.Index(host=host)


def upsert_file(pc: Pinecone, file_path: str, index_name: str):
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"{file_path} not found")

    text = path.read_text(encoding="utf-8", errors="ignore")
    chunks = chunk_text(text)
    print(f"{path.name}: {len(chunks)} chunks")

    index = get_or_create_index(pc, index_name)

    records = [
        {
            "_id": f"{path.stem}-{i}",
            "chunk_text": chunk,      # embedded by Pinecone
            "source": path.name,      # metadata
            "chunk_index": i,         # metadata
        }
        for i, chunk in enumerate(chunks)
    ]

    for start in range(0, len(records), BATCH_SIZE):
        batch = records[start:start + BATCH_SIZE]
        index.upsert_records(namespace=NAMESPACE, records=batch)
        print(f"  upserted {start + len(batch)}/{len(records)}")
        time.sleep(0.5)  # gentle on rate limits

    # Stats can lag a few seconds behind writes
    time.sleep(10)
    print(f"  index stats: {index.describe_index_stats()}\n")


def search_demo(pc: Pinecone, index_name: str, query: str, top_k: int = 3):
    """Optional: quick sanity-check query."""
    index = pc.Index(host=pc.describe_index(name=index_name).host)
    results = index.search(
        namespace=NAMESPACE,
        query={"inputs": {"text": query}, "top_k": top_k},
    )
    for hit in results["result"]["hits"]:
        print(f"{hit['_score']:.3f} | {hit['_id']} | {hit['fields']['chunk_text'][:100]}...")


def main():
    if not API_KEY:
        raise SystemExit("Set the PINECONE_API_KEY environment variable first.")

    pc = Pinecone(api_key=API_KEY)

    for file_path, index_name in FILES_TO_INDEXES.items():
        upsert_file(pc, file_path, index_name)

    # Uncomment to test retrieval:
    # search_demo(pc, "residential-index", "average home prices")
    # search_demo(pc, "office-market-index", "office vacancy rates")


if __name__ == "__main__":
    main()