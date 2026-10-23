from __future__ import annotations

import copy
import functools
import math
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

from postgrest import APIError

from .db import favourites_table, properties_table
from .query_builder import SQFT_UNITS, apply_filters, like_contains, like_exact
from .schemas import (
    ALL_CLASSES,
    ASSET_CLASSES,
    PROPERTY_TYPES,
    REGIONS,
    TENURES,
    FilterOptions,
    FilterRanges,
    MinMax,
    PaginatedProperties,
    PropertyDetail,
    PropertySummary,
    SearchFilters,
    SortField,
    SortOrder,
)

SUMMARY_COLUMNS = ",".join(PropertySummary.model_fields)
PAGE = 1000  # PostgREST default max rows per request

SORT_COLUMNS = {
    SortField.name: "property_name",
    SortField.price: "price_guide_price",
    SortField.rent: "rent_income_pa",
    SortField.size: "size",
    SortField.yield_: "niy_yield",
    SortField.price_psf: "price_psf",
    SortField.city: "city",
    SortField.country: "country",
}


def ttl_cache(seconds: int):
    def deco(fn):
        store: dict = {}

        @functools.wraps(fn)
        def wrapper(*args):
            now = time.monotonic()
            hit = store.get(args)
            if hit and now - hit[0] < seconds:
                return copy.deepcopy(hit[1])
            value = fn(*args)
            store[args] = (now, value)
            return copy.deepcopy(value)

        return wrapper

    return deco


# ---------- Search ----------


def count_properties(f: SearchFilters, skip: frozenset[str] = frozenset()) -> int:
    q = properties_table().select("property_id", count="exact", head=True)
    return apply_filters(q, f, skip=skip).execute().count or 0


def search_properties(
    f: SearchFilters, page: int, page_size: int, sort_by: SortField, sort_order: SortOrder
) -> PaginatedProperties:
    start = (page - 1) * page_size
    q = apply_filters(properties_table().select(SUMMARY_COLUMNS, count="exact"), f)
    q = q.order(SORT_COLUMNS[sort_by], desc=sort_order == SortOrder.desc, nullsfirst=False)
    q = q.order("property_id")  # tiebreaker keeps pagination stable

    try:
        res = q.range(start, start + page_size - 1).execute()
        rows, total = res.data, res.count or 0
    except APIError as e:
        if getattr(e, "code", None) != "PGRST103":  # page beyond the last row
            raise
        rows, total = [], count_properties(f)

    return PaginatedProperties(
        items=[PropertySummary(**r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 0,
        has_next=start + len(rows) < total,
        filters=f,
    )


def get_property(property_id: UUID) -> PropertyDetail | None:
    res = properties_table().select("*").eq("property_id", str(property_id)).limit(1).execute()
    return PropertyDetail(**res.data[0]) if res.data else None


# ---------- Favourites ----------


def get_favourites(user_id: UUID) -> list[str]:
    res = (
        favourites_table()
        .select("property_id")
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .execute()
    )
    return [row["property_id"] for row in res.data]


def get_favourite_properties(user_id: UUID) -> list[PropertySummary]:
    property_ids = get_favourites(user_id)
    if not property_ids:
        return []

    res = (
        properties_table()
        .select(SUMMARY_COLUMNS)
        .in_("property_id", property_ids)
        .execute()
    )
    properties = {
        row["property_id"]: PropertySummary(**row)
        for row in res.data
    }
    return [properties[property_id] for property_id in property_ids if property_id in properties]


def save_favourite(user_id: UUID, property_id: UUID) -> None:
    favourites_table().upsert(
        {"user_id": str(user_id), "property_id": str(property_id)},
        on_conflict="user_id,property_id",
        ignore_duplicates=True,
    ).execute()


def remove_favourite(user_id: UUID, property_id: UUID) -> None:
    (
        favourites_table()
        .delete()
        .eq("user_id", str(user_id))
        .eq("property_id", str(property_id))
        .execute()
    )


# ---------- Facets (sidebar counts) ----------


def asset_class_counts(f: SearchFilters) -> dict[str, int]:
    """Counts per asset class under all *other* active filters, in the shape the
    frontend expects for `assetClassCounts`."""
    skip = frozenset({"asset_class"})
    with ThreadPoolExecutor(max_workers=len(ASSET_CLASSES) + 1) as ex:
        total = ex.submit(count_properties, f, skip)
        futures = {
            cls: ex.submit(count_properties, f.model_copy(update={"asset_class": cls}))
            for cls in ASSET_CLASSES
        }
        counts = {ALL_CLASSES: total.result()}
        counts.update({cls: fut.result() for cls, fut in futures.items()})
    return counts


# ---------- Filter options ----------


@ttl_cache(300)
def distinct_values(column: str, region: str | None = None, country: str | None = None, q: str | None = None):
    seen: dict[str, str] = {}
    offset = 0
    while True:
        qry = properties_table().select(column)
        if region:
            qry = qry.ilike("region", like_exact(region))
        if country:
            qry = qry.ilike("country", like_exact(country))
        if q:
            qry = qry.ilike(column, like_contains(q))
        rows = qry.order(column).range(offset, offset + PAGE - 1).execute().data
        for r in rows:
            v = (r.get(column) or "").strip()
            if v:
                seen.setdefault(v.casefold(), v)
        if len(rows) < PAGE:
            break
        offset += PAGE
    return sorted(seen.values(), key=str.casefold)


def _canonical_first(canonical: list[str], found: list[str]) -> list[str]:
    lower = {c.casefold() for c in canonical}
    return canonical + [v for v in found if v.casefold() not in lower]


def filter_options() -> FilterOptions:
    return FilterOptions(
        regions=_canonical_first(REGIONS, distinct_values("region")),
        countries=distinct_values("country"),
        property_types=_canonical_first(PROPERTY_TYPES, distinct_values("property_type")),
        asset_classes=_canonical_first(ASSET_CLASSES, distinct_values("asset_class")),
        sale_types=distinct_values("sale_type"),
        tenures=_canonical_first(TENURES, distinct_values("tenure")),
        currencies=distinct_values("currency"),
    )


@ttl_cache(300)
def value_ranges(currency: str) -> FilterRanges:
    """Min/max bounds for the advanced-filter inputs (placeholders, sliders, validation)."""

    def extreme(column: str, desc: bool, *, by_currency=False, sqft_only=False):
        q = properties_table().select(column)
        if by_currency:
            q = q.ilike("currency", like_exact(currency))
        if sqft_only:
            q = q.or_(",".join(f"unit.ilike.{u}" for u in SQFT_UNITS))
        rows = q.order(column, desc=desc, nullsfirst=False).limit(1).execute().data
        return rows[0][column] if rows else None

    def mm(column: str, **kw) -> MinMax:
        return MinMax(min=extreme(column, False, **kw), max=extreme(column, True, **kw))

    return FilterRanges(
        currency=currency,
        price=mm("price_guide_price", by_currency=True),
        rent_per_annum=mm("rent_income_pa", by_currency=True),
        size_sqft=mm("size", sqft_only=True),
        net_initial_yield=mm("niy_yield"),
    )