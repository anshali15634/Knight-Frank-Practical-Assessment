import os
from functools import lru_cache

from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

TABLE = "kf_properties"


@lru_cache
def get_client() -> Client:
    """Created lazily on first request, so it works even though this module is imported
    before main.py calls load_dotenv(). Uses the same env vars as main.py."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SECRET_KEY")
    return create_client(url, key, options=SyncClientOptions(postgrest_client_timeout=10))


def properties_table():
    return get_client().table(TABLE)