from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Frontend "no filter" labels. Treated as null so the UI can send its raw select values.
ALL_REGIONS = "All regions"
ALL_TYPES = "All property types"
ALL_TENURES = "All tenures"
ALL_CLASSES = "All asset classes"
_SENTINELS = {
    ALL_REGIONS.lower(),
    ALL_TYPES.lower(),
    ALL_TENURES.lower(),
    ALL_CLASSES.lower(),
}

REGIONS = ["UK", "Europe", "USA", "Middle East", "Asia", "Australia", "Africa", "Rest of the World"]
PROPERTY_TYPES = ["Commercial", "Residential"]
TENURES = ["Leasehold", "Freehold", "Not mentioned"]
ASSET_CLASSES = [
    "Industrial, Logistics & Data Centres",
    "Retail",
    "Offices",
    "Hotels",
    "Mixed Use",
    "Other",
]


class SortField(str, Enum):
    name = "name"
    price = "price"
    rent = "rent"
    size = "size"
    yield_ = "yield"
    price_psf = "price_psf"
    city = "city"
    country = "country"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class Range(BaseModel):
    min: float | None = Field(None, ge=0)
    max: float | None = Field(None, ge=0)

    @model_validator(mode="after")
    def _check_order(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("min must be less than or equal to max")
        return self

    @property
    def active(self) -> bool:
        return self.min is not None or self.max is not None


class SearchFilters(BaseModel):
    """Same shape as the frontend `SearchFilters` type (camelCase accepted, snake_case too)."""

    model_config = ConfigDict(populate_by_name=True)

    region: str | None = None
    country: str | None = None
    city: str | None = None
    property_type: str | None = Field(None, alias="propertyType")
    asset_class: str | None = Field(None, alias="assetClass")
    property_name: str | None = Field(None, alias="propertyName")

    # Extras beyond the current UI
    q: str | None = Field(None, description="Keyword search across name, city, country, description, tenant")
    sale_type: str | None = Field(None, alias="saleType")
    tenure: str | None = None
    is_synthetic: bool | None = Field(None, alias="isSynthetic")

    currency: str | None = Field(
        None, description="Currency of the price/rent ranges. Only applied when a price or rent range is set."
    )
    price: Range = Field(default_factory=Range)
    rent_per_annum: Range = Field(default_factory=Range, alias="rentPerAnnum")
    size_sqft: Range = Field(default_factory=Range, alias="sizeSqft")
    net_initial_yield: Range = Field(default_factory=Range, alias="netInitialYield")
    price_psf: Range = Field(default_factory=Range, alias="pricePsf")
    rent_psf: Range = Field(default_factory=Range, alias="rentPsf")

    @field_validator(
        "region", "country", "city", "property_type", "asset_class",
        "property_name", "q", "sale_type", "tenure",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, v: Any):
        if v is None:
            return None
        v = str(v).strip()
        if not v or v.lower() in _SENTINELS:
            return None
        return v

    @field_validator("currency", mode="before")
    @classmethod
    def _currency(cls, v: Any):
        if v is None or not str(v).strip():
            return None
        v = str(v).strip().upper()
        if len(v) != 3 or not v.isalpha():
            raise ValueError("currency must be a 3-letter ISO code")
        return v

    @field_validator(
        "price", "rent_per_annum", "size_sqft", "net_initial_yield", "price_psf", "rent_psf",
        mode="before",
    )
    @classmethod
    def _null_range(cls, v: Any):
        return {} if v is None else v


class SearchRequest(SearchFilters):
    """POST body: filters + pagination + sorting."""

    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100, alias="pageSize")
    sort_by: SortField = Field(SortField.name, alias="sortBy")
    sort_order: SortOrder = Field(SortOrder.asc, alias="sortOrder")

    def filters(self) -> SearchFilters:
        return SearchFilters.model_validate(self.model_dump(include=set(SearchFilters.model_fields)))


# ---------- Responses ----------


class PropertySummary(BaseModel):
    property_id: str
    property_name: str | None = None
    city: str | None = None
    country: str | None = None
    region: str | None = None
    asset_class: str | None = None
    property_type: str | None = None
    short_description: str | None = None
    tenure: str | None = None
    sale_type: str | None = None
    price_guide_price: int | None = None
    currency: str | None = None
    niy_yield: float | None = None
    price_psf: int | None = None
    size: int | None = None
    unit: str | None = None
    tenant: str | None = None
    rent_income_pa: int | None = None
    rent_psf: int | None = None
    image_url: str | None = None
    is_synthetic: bool | None = None


class PropertyDetail(PropertySummary):
    pdf_section: str | None = None
    pdf_page: str | None = None
    term_wault: str | None = None
    service_charge: str | None = None
    completion: str | None = None
    comments_other_details: str | None = None


class PaginatedProperties(BaseModel):
    items: list[PropertySummary]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    filters: SearchFilters


class FilterOptions(BaseModel):
    regions: list[str]
    countries: list[str]
    property_types: list[str]
    asset_classes: list[str]
    sale_types: list[str]
    tenures: list[str]
    currencies: list[str]


class MinMax(BaseModel):
    min: float | None = None
    max: float | None = None


class FilterRanges(BaseModel):
    currency: str
    price: MinMax
    rent_per_annum: MinMax
    size_sqft: MinMax
    net_initial_yield: MinMax