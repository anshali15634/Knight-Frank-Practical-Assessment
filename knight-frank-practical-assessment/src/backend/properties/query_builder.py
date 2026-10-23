"""Turns a SearchFilters object into PostgREST conditions. Every filter is optional and
they all AND together, so every combination works."""
from __future__ import annotations

import math
import re

from .schemas import Range, SearchFilters

SQFT_PER_SQM = 10.7639

# `unit` is free text in the table, so match it loosely. Adjust to your real data.
SQFT_UNITS = ["*sq*ft*", "*square*f*"]
SQM_UNITS = ["*sqm*", "*sq*m", "*sq*m.", "*sq*metre*", "*sq*meter*", "*square*met*"]

KEYWORD_COLUMNS = ["property_name", "city", "country", "short_description", "tenant"]


def like_exact(v: str) -> str:
    """Case-insensitive exact match for .ilike() (escapes LIKE wildcards)."""
    return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def like_contains(v: str) -> str:
    return f"%{like_exact(v)}%"


def _or_token(v: str) -> str:
    """Strip characters that would break a PostgREST or=(...) expression."""
    return re.sub(r'[,()"*%\\:]', " ", v).strip()


def _between(q, column: str, r: Range, *, integer: bool):
    lo, hi = r.min, r.max
    if integer:  # int8 columns: round inwards so we never send "92.9" to a bigint compare
        lo = None if lo is None else math.ceil(lo)
        hi = None if hi is None else math.floor(hi)
    if lo is not None:
        q = q.gte(column, lo)
    if hi is not None:
        q = q.lte(column, hi)
    return q


def size_or_expression(r: Range) -> str:
    """Size is stored in its own `unit`. The UI filters in sq ft, so rows in sq ft are compared
    directly and rows in sq m are compared against the converted bounds."""

    def branch(units: list[str], factor: float) -> str:
        parts = ["or(" + ",".join(f"unit.ilike.{u}" for u in units) + ")"]
        if r.min is not None:
            parts.append(f"size.gte.{math.ceil(r.min / factor)}")
        if r.max is not None:
            parts.append(f"size.lte.{math.floor(r.max / factor)}")
        return "and(" + ",".join(parts) + ")"

    return ",".join([branch(SQFT_UNITS, 1.0), branch(SQM_UNITS, SQFT_PER_SQM)])


def apply_filters(q, f: SearchFilters, *, skip: frozenset[str] = frozenset()):
    """`skip` lets facet counts ignore a filter, e.g. skip={"asset_class"}."""
    if f.region and "region" not in skip:
        q = q.ilike("region", like_exact(f.region))
    if f.country:
        q = q.ilike("country", like_contains(f.country))
    if f.city:
        q = q.ilike("city", like_contains(f.city))
    if f.property_type and "property_type" not in skip:
        q = q.ilike("property_type", like_exact(f.property_type))
    if f.asset_class and "asset_class" not in skip:
        q = q.ilike("asset_class", like_exact(f.asset_class))
    if f.property_name:
        q = q.ilike("property_name", like_contains(f.property_name))
    if f.sale_type:
        q = q.ilike("sale_type", like_exact(f.sale_type))
    if f.tenure:
        q = q.ilike("tenure", like_exact(f.tenure))
    if f.is_synthetic is not None:
        q = q.eq("is_synthetic", f.is_synthetic)

    # Keyword search: every word must match at least one column.
    if f.q:
        for term in filter(None, (_or_token(t) for t in f.q.split())):
            q = q.or_(",".join(f"{c}.ilike.*{term}*" for c in KEYWORD_COLUMNS))

    # Price and rent amounts only make sense within one currency.
    if f.price.active or f.rent_per_annum.active or f.price_psf.active or f.rent_psf.active:
        if f.currency:
            q = q.ilike("currency", like_exact(f.currency))
    q = _between(q, "price_guide_price", f.price, integer=True)
    q = _between(q, "rent_income_pa", f.rent_per_annum, integer=True)
    q = _between(q, "niy_yield", f.net_initial_yield, integer=False)
    q = _between(q, "price_psf", f.price_psf, integer=True)
    q = _between(q, "rent_psf", f.rent_psf, integer=True)

    if f.size_sqft.active:
        q = q.or_(size_or_expression(f.size_sqft))
    return q