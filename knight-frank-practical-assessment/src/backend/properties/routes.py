from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import ValidationError

from auth_tokens import authenticated_user_id
from . import services
from .schemas import (
    FilterOptions,
    FilterRanges,
    PaginatedProperties,
    PropertyDetail,
    PropertySummary,
    Range,
    SearchFilters,
    SearchRequest,
    SortField,
    SortOrder,
)

router = APIRouter(prefix="/api/v1/properties")


def filters_from_query(
    region: str | None = Query(None, description="e.g. Europe. 'All regions' = no filter"),
    country: str | None = Query(None, description="Partial, case-insensitive"),
    city: str | None = Query(None, description="Partial, case-insensitive"),
    property_type: str | None = Query(None, description="Commercial | Residential"),
    asset_class: str | None = Query(None, description="e.g. Offices"),
    property_name: str | None = Query(None, description="Partial, case-insensitive"),
    q: str | None = Query(None, description="Keyword search across name, city, country, description, tenant"),
    sale_type: str | None = None,
    tenure: str | None = Query(None, description="Leasehold | Freehold | Not mentioned"),
    is_synthetic: bool | None = None,
    currency: str | None = Query(None, description="Applies only with a price or rent range, e.g. GBP"),
    price_min: float | None = Query(None, ge=0),
    price_max: float | None = Query(None, ge=0),
    rent_min: float | None = Query(None, ge=0, description="Rent income per annum"),
    rent_max: float | None = Query(None, ge=0),
    size_min: float | None = Query(None, ge=0, description="sq ft (sq m rows are converted)"),
    size_max: float | None = Query(None, ge=0),
    yield_min: float | None = Query(None, ge=0, description="Net initial yield, %"),
    yield_max: float | None = Query(None, ge=0),
    price_psf_min: float | None = Query(None, ge=0),
    price_psf_max: float | None = Query(None, ge=0),
    rent_psf_min: float | None = Query(None, ge=0),
    rent_psf_max: float | None = Query(None, ge=0),
) -> SearchFilters:
    try:
        return SearchFilters(
            region=region, country=country, city=city, property_type=property_type,
            asset_class=asset_class, property_name=property_name, q=q, sale_type=sale_type,
            tenure=tenure, is_synthetic=is_synthetic, currency=currency,
            price=Range(min=price_min, max=price_max),
            rent_per_annum=Range(min=rent_min, max=rent_max),
            size_sqft=Range(min=size_min, max=size_max),
            net_initial_yield=Range(min=yield_min, max=yield_max),
            price_psf=Range(min=price_psf_min, max=price_psf_max),
            rent_psf=Range(min=rent_psf_min, max=rent_psf_max),
        )
    except ValidationError as e:
        raise HTTPException(422, detail=[{"loc": x["loc"], "msg": x["msg"]} for x in e.errors()])


# ---------- Search ----------


@router.get("/search", response_model=PaginatedProperties, tags=["Search"],
            summary="Search properties (query params)")
def search_get(
    filters: SearchFilters = Depends(filters_from_query),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: SortField = SortField.name,
    sort_order: SortOrder = SortOrder.asc,
):
    return services.search_properties(filters, page, page_size, sort_by, sort_order)


@router.post("/search", response_model=PaginatedProperties, tags=["Search"],
             summary="Search properties (JSON body, same shape as the frontend SearchFilters)")
def search_post(body: SearchRequest):
    return services.search_properties(body.filters(), body.page, body.page_size, body.sort_by, body.sort_order)


# ---------- Facets ----------


@router.get("/facets/asset-classes", response_model=dict[str, int], tags=["Facets"],
            summary="Counts per asset class (for the sidebar `assetClassCounts` prop)")
def asset_class_counts(filters: SearchFilters = Depends(filters_from_query)):
    return services.asset_class_counts(filters)


# ---------- Filter options ----------


@router.get("/filters/options", response_model=FilterOptions, tags=["Filter options"],
            summary="All dropdown values")
def filter_options():
    return services.filter_options()


@router.get("/filters/countries", response_model=list[str], tags=["Filter options"],
            summary="Countries, optionally within a region (autocomplete)")
def countries(region: str | None = None, q: str | None = Query(None, description="Autocomplete text")):
    region = SearchFilters(region=region).region
    return services.distinct_values("country", region, None, (q or "").strip() or None)


@router.get("/filters/cities", response_model=list[str], tags=["Filter options"],
            summary="Cities, optionally within a region and/or country (autocomplete)")
def cities(region: str | None = None, country: str | None = None,
           q: str | None = Query(None, description="Autocomplete text")):
    region = SearchFilters(region=region).region
    country = SearchFilters(country=country).country
    return services.distinct_values("city", region, country, (q or "").strip() or None)


@router.get("/filters/ranges", response_model=FilterRanges, tags=["Filter options"],
            summary="Min/max of price, rent, size and yield")
def ranges(currency: str = Query("GBP", min_length=3, max_length=3)):
    return services.value_ranges(currency.upper())


# ---------- Favourites ----------


@router.get("/favorites", response_model=list[str], tags=["Favourites"])
def get_favourites(user_id: UUID = Depends(authenticated_user_id)):
    return services.get_favourites(user_id)


@router.get(
    "/favorites/properties",
    response_model=list[PropertySummary],
    tags=["Favourites"],
)
def get_favourite_properties(user_id: UUID = Depends(authenticated_user_id)):
    return services.get_favourite_properties(user_id)


@router.post(
    "/favorites/{property_id}",
    status_code=204,
    response_class=Response,
    tags=["Favourites"],
)
def save_favourite(
    property_id: UUID,
    user_id: UUID = Depends(authenticated_user_id),
):
    services.save_favourite(user_id, property_id)
    return Response(status_code=204)


@router.delete(
    "/favorites/{property_id}",
    status_code=204,
    response_class=Response,
    tags=["Favourites"],
)
def remove_favourite(
    property_id: UUID,
    user_id: UUID = Depends(authenticated_user_id),
):
    services.remove_favourite(user_id, property_id)
    return Response(status_code=204)


# ---------- Detail (keep last so it doesn't shadow the static routes) ----------


@router.get("/{property_id}", response_model=PropertyDetail, tags=["Detail"], summary="Property by id")
def get_property(property_id: UUID):
    prop = services.get_property(property_id)
    if prop is None:
        raise HTTPException(404, "Property not found")
    return prop