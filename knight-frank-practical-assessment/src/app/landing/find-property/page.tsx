"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import "./find-property.css";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
const PAGE_SIZE = 20;
const FILTER_CURRENCY = "AED";

/* ---------- Static options ---------- */

const ALL_REGIONS = "All regions";
const REGIONS = [
  ALL_REGIONS,
  "UK",
  "Europe",
  "USA",
  "Middle East",
  "Asia",
  "Australia",
  "Africa",
  "Rest of the World",
];

const ALL_TYPES = "All property types";
const PROPERTY_TYPES = [ALL_TYPES, "Commercial", "Residential"];

const ALL_CLASSES = "All asset classes";
const ASSET_CLASSES = [
  "Industrial, Logistics & Data Centres",
  "Retail",
  "Offices",
  "Hotels",
  "Mixed Use",
  "Other",
];

/* ---------- Filter ranges ---------- */

type RangeKey = "price" | "rent" | "size" | "yield";
type Limits = { min: number | null; max: number | null };
type RangeInputValue = { min: string; max: string };

const RANGE_LABELS: Record<RangeKey, string> = {
  price: "Price / guide price",
  rent: "Rent income per annum",
  size: "Size",
  yield: "Net initial yield",
};
const RANGE_KEYS: RangeKey[] = ["price", "rent", "size", "yield"];

function rangeLimits(value: RangeInputValue): Limits {
  return {
    min: value.min === "" ? null : Number(value.min),
    max: value.max === "" ? null : Number(value.max),
  };
}

function rangeText(value: RangeInputValue, fmt: (v: number) => string) {
  const bounds = rangeLimits(value);
  if (bounds.min === null && bounds.max === null) return "Any";
  const from = bounds.min === null ? "No min" : fmt(bounds.min);
  const to = bounds.max === null ? "No max" : fmt(bounds.max);
  return `${from} – ${to}`;
}

/* ---------- Types ---------- */

type SearchFilters = {
  region: string | null;
  country: string | null;
  city: string | null;
  propertyType: string | null;
  assetClass: string | null;
  propertyName: string | null;
  currency: string;
  price: Limits;
  rentPerAnnum: Limits;
  sizeSqft: Limits;
  netInitialYield: Limits;
};

type Property = {
  property_id: string;
  property_name: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  asset_class: string | null;
  property_type: string | null;
  short_description: string | null;
  tenure: string | null;
  sale_type: string | null;
  price_guide_price: number | null;
  currency: string | null;
  niy_yield: number | null;
  price_psf: number | null;
  size: number | null;
  unit: string | null;
  tenant: string | null;
  rent_income_pa: number | null;
  rent_psf: number | null;
  image_url: string | null;
};

type PropertyDetails = Property & {
  term_wault: string | null;
  completion: string | null;
  comments_other_details: string | null;
};

type SearchResponse = {
  items: Property[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
};

type Props = {
  region?: string;
  /** Optional counts shown beside each asset class, e.g. { "Offices": 12, "All asset classes": 95 } */
  assetClassCounts?: Record<string, number>;
  onSearch?: (filters: SearchFilters) => void;
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-GB")}`;
  }
}

function formatOptionalMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  return value === null || value === undefined
    ? "Not specified"
    : formatMoney(value, currency || FILTER_CURRENCY);
}

async function searchErrorMessage(response: Response) {
  const fallback = `Property search failed (${response.status}).`;

  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = body.detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((item) =>
            item && typeof item === "object" && "msg" in item
              ? String(item.msg)
              : String(item),
          )
          .join(", ");
      }
    }
  } catch {
    return fallback;
  }

  return fallback;
}

/* ---------- Small building blocks ---------- */

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6l5 5 5-5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </svg>
  );
}

function PillSelect({
  id,
  label,
  value,
  defaultValue,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="fp-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="fp-pill"
        data-active={value !== defaultValue}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RangeInputs({
  id,
  label,
  value,
  onChange,
  formatValue,
  step,
}: {
  id: string;
  label: string;
  value: RangeInputValue;
  onChange: (next: RangeInputValue) => void;
  formatValue: (v: number) => string;
  step: number;
}) {
  return (
    <div className="fp-range" role="group" aria-labelledby={`${id}-label`}>
      <div className="fp-range-head">
        <span id={`${id}-label`} className="fp-range-label">
          {label}
        </span>
        <output className="fp-range-value">{rangeText(value, formatValue)}</output>
      </div>
      <div className="fp-range-inputs">
        <label className="fp-range-bound">
          <span>Minimum</span>
          <input
            className="fp-input"
            type="number"
            min={0}
            max={value.max || undefined}
            step={step}
            aria-label={`${label} minimum`}
            placeholder="No minimum"
            value={value.min}
            onChange={(event) => onChange({ ...value, min: event.target.value })}
          />
        </label>
        <label className="fp-range-bound">
          <span>Maximum</span>
          <input
            className="fp-input"
            type="number"
            min={value.min || 0}
            step={step}
            aria-label={`${label} maximum`}
            placeholder="No maximum"
            value={value.max}
            onChange={(event) => onChange({ ...value, max: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AssetsPropertiesSearchMain({
  region = ALL_REGIONS,
  assetClassCounts,
  onSearch,
}: Props) {
  const uid = useId();
  const startRegion = REGIONS.includes(region) ? region : ALL_REGIONS;

  // Location state is keyed to the `region` prop so a new prop resets it.
  const [loc, setLoc] = useState({ source: region, region: startRegion, country: "", city: "" });
  const current =
    loc.source === region ? loc : { source: region, region: startRegion, country: "", city: "" };

  const [propertyType, setPropertyType] = useState(ALL_TYPES);
  const [assetClass, setAssetClass] = useState(ALL_CLASSES);
  const [propertyName, setPropertyName] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ranges, setRanges] = useState<Record<RangeKey, RangeInputValue>>({
    price: { min: "", max: "" },
    rent: { min: "", max: "" },
    size: { min: "", max: "" },
    yield: { min: "", max: "" },
  });
  const [searchSummary, setSearchSummary] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [currentFilters, setCurrentFilters] = useState<SearchFilters | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const requestController = useRef<AbortController | null>(null);
  const detailsController = useRef<AbortController | null>(null);
  const closeDetailsRef = useRef<HTMLButtonElement>(null);
  const detailsPanelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closePropertyDetails = useCallback(() => {
    detailsController.current?.abort();
    detailsController.current = null;
    setSelectedProperty(null);
    returnFocusRef.current?.focus();
  }, []);

  useEffect(
    () => () => requestController.current?.abort(),
    [],
  );

  useEffect(() => {
    if (results) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [results]);

  useEffect(() => {
    if (!selectedProperty) return;

    const propertyId = selectedProperty.property_id;
    const controller = new AbortController();
    detailsController.current = controller;

    async function loadDetails() {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/properties/${encodeURIComponent(propertyId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Property details failed (${response.status}).`);
        }

        const details: PropertyDetails = await response.json();
        if (detailsController.current === controller) setPropertyDetails(details);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (detailsController.current === controller) {
          setDetailsError(
            error instanceof Error ? error.message : "Unable to load property details.",
          );
        }
      } finally {
        if (detailsController.current === controller) {
          detailsController.current = null;
          setDetailsLoading(false);
        }
      }
    }

    void loadDetails();
    return () => {
      controller.abort();
      if (detailsController.current === controller) detailsController.current = null;
    };
  }, [selectedProperty]);

  useEffect(() => {
    if (!selectedProperty) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeDetailsRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePropertyDetails();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = detailsPanelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedProperty, closePropertyDetails]);

  function openPropertyDetails(property: Property, trigger: HTMLElement) {
    detailsController.current?.abort();
    detailsController.current = null;
    returnFocusRef.current = trigger;
    setPropertyDetails(null);
    setDetailsLoading(true);
    setDetailsError("");
    setSelectedProperty(property);
  }

  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: FILTER_CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
  const formats: Record<RangeKey, (v: number) => string> = {
    price: (v) => money.format(v),
    rent: (v) => money.format(v),
    size: (v) => `${compact.format(v)} sq ft`,
    yield: (v) => `${Number(v.toFixed(2))}%`,
  };

  const activeRanges = RANGE_KEYS.filter((k) => ranges[k].min !== "" || ranges[k].max !== "");

  const trail = [
    current.region !== ALL_REGIONS ? current.region : "",
    current.country.trim(),
    current.city.trim(),
  ].filter(Boolean);

  function changeRegion(next: string) {
    // Broad filter changed: clear the narrower location filters beneath it.
    setLoc({ source: region, region: next, country: "", city: "" });
  }

  function reset() {
    requestController.current?.abort();
    requestController.current = null;
    detailsController.current?.abort();
    detailsController.current = null;
    setSelectedProperty(null);
    setIsLoading(false);
    setResults(null);
    setCurrentFilters(null);
    setSearchError("");
    setLoc({ source: region, region: startRegion, country: "", city: "" });
    setPropertyType(ALL_TYPES);
    setAssetClass(ALL_CLASSES);
    setPropertyName("");
    setRanges({
      price: { min: "", max: "" },
      rent: { min: "", max: "" },
      size: { min: "", max: "" },
      yield: { min: "", max: "" },
    });
    setSearchSummary("");
  }

  async function loadProperties(filters: SearchFilters, page: number) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setIsLoading(true);
    setSearchError("");
    setCurrentFilters(filters);
    if (page === 1) setResults(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/properties/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...filters,
          page,
          pageSize: PAGE_SIZE,
          sortBy: "name",
          sortOrder: "asc",
        }),
      });

      if (!response.ok) {
        throw new Error(await searchErrorMessage(response));
      }

      const data: SearchResponse = await response.json();
      setResults(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSearchError(
        error instanceof Error ? error.message : "Unable to load properties.",
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setIsLoading(false);
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const filters: SearchFilters = {
      region: current.region === ALL_REGIONS ? null : current.region,
      country: current.country.trim() || null,
      city: current.city.trim() || null,
      propertyType: propertyType === ALL_TYPES ? null : propertyType,
      assetClass: assetClass === ALL_CLASSES ? null : assetClass,
      propertyName: propertyName.trim() || null,
      currency: FILTER_CURRENCY,
      price: rangeLimits(ranges.price),
      rentPerAnnum: rangeLimits(ranges.rent),
      sizeSqft: rangeLimits(ranges.size),
      netInitialYield: rangeLimits(ranges.yield),
    };

    const criteria = [
      trail.length ? trail.join(" › ") : "all locations",
      propertyType === ALL_TYPES ? "all property types" : propertyType.toLowerCase(),
      assetClass === ALL_CLASSES ? "all asset classes" : assetClass,
    ];
    if (filters.propertyName) criteria.push(`name “${filters.propertyName}”`);
    activeRanges.forEach((k) =>
      criteria.push(`${RANGE_LABELS[k].toLowerCase()} ${rangeText(ranges[k], formats[k])}`),
    );

    setSearchSummary(`Search criteria: ${criteria.join(" · ")}`);
    onSearch?.(filters);
    void loadProperties(filters, 1);
  }

  return (
    <div className="property-search-page fp-page">
      <div className="property-search-heading">
        <p className="investment-eyebrow">KNIGHT FRANK · PROPERTY SEARCH</p>
        <h2>Find your next investment</h2>
        <p>Search property opportunities by location, asset class and price.</p>
      </div>

      <div className="fp-layout">
        <nav className="fp-nav" aria-labelledby={`${uid}-nav`}>
          <p className="fp-nav-title" id={`${uid}-nav`}>
            Asset class
          </p>
          <ul>
            {[ALL_CLASSES, ...ASSET_CLASSES].map((item) => {
              const count = assetClassCounts?.[item];
              return (
                <li key={item}>
                  <button
                    type="button"
                    className="fp-nav-item"
                    aria-current={assetClass === item ? "true" : undefined}
                    onClick={() => setAssetClass(item)}
                  >
                    <span>{item}</span>
                    {count !== undefined && <span className="fp-nav-count">{count}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <form className="fp-form" onSubmit={handleSubmit}>
          <div className="fp-stack">
            <div className="fp-group" data-level="1">
              <h3 className="fp-group-title">Region and property type</h3>
              <div className="fp-row">
                <PillSelect
                  id={`${uid}-region`}
                  label="Region"
                  value={current.region}
                  defaultValue={ALL_REGIONS}
                  options={REGIONS.map((r) => ({ value: r, label: r }))}
                  onChange={changeRegion}
                />
                <PillSelect
                  id={`${uid}-type`}
                  label="Property type"
                  value={propertyType}
                  defaultValue={ALL_TYPES}
                  options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
                  onChange={setPropertyType}
                />
              </div>
            </div>

            <div className="fp-group" data-level="2">
              <h3 className="fp-group-title">Country and city</h3>
              <div className="fp-row">
                <div className="fp-field">
                  <label htmlFor={`${uid}-country`}>Country</label>
                  <input
                    id={`${uid}-country`}
                    className="fp-input"
                    type="text"
                    autoComplete="off"
                    value={current.country}
                    onChange={(event) => setLoc({ ...current, country: event.target.value })}
                    placeholder="e.g. Germany"
                  />
                </div>
                <div className="fp-field">
                  <label htmlFor={`${uid}-city`}>City</label>
                  <input
                    id={`${uid}-city`}
                    className="fp-input"
                    type="text"
                    autoComplete="off"
                    value={current.city}
                    onChange={(event) => setLoc({ ...current, city: event.target.value })}
                    placeholder="e.g. Frankfurt"
                  />
                </div>
              </div>
              {trail.length > 0 && (
                <ol className="fp-trail" aria-label="Location filter">
                  <li className="fp-trail-lead">Searching in</li>
                  {trail.map((part) => (
                    <li key={part}>{part}</li>
                  ))}
                </ol>
              )}
            </div>

            <div className="fp-group" data-level="3">
              <h3 className="fp-group-title">Property name</h3>
              <div className="fp-search">
                <SearchIcon />
                <input
                  className="fp-input"
                  type="search"
                  autoComplete="off"
                  aria-label="Property name"
                  value={propertyName}
                  onChange={(event) => setPropertyName(event.target.value)}
                  placeholder="Search for property name..."
                />
              </div>
            </div>

            <div className="fp-group" data-level="4">
              <h3 className="fp-group-title">
                <button
                  type="button"
                  className="fp-disclosure"
                  aria-expanded={advancedOpen}
                  aria-controls={`${uid}-advanced`}
                  onClick={() => setAdvancedOpen((open) => !open)}
                >
                  Advanced filters
                  {activeRanges.length > 0 && (
                    <span className="fp-badge" aria-label={`${activeRanges.length} active`}>
                      {activeRanges.length}
                    </span>
                  )}
                  <Chevron />
                </button>
              </h3>

              <div className="fp-advanced" id={`${uid}-advanced`} hidden={!advancedOpen}>
                <div className="fp-advanced-grid">
                  {RANGE_KEYS.map((key) => (
                    <RangeInputs
                      key={key}
                      id={`${uid}-${key}`}
                      label={RANGE_LABELS[key]}
                      value={ranges[key]}
                      formatValue={formats[key]}
                      step={key === "yield" ? 0.01 : 1}
                      onChange={(next) => setRanges((r) => ({ ...r, [key]: next }))}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="fp-actions">
            <button type="button" className="fp-reset" onClick={reset}>
              Reset filters
            </button>
            <button type="submit" className="fp-submit">
              Search properties
            </button>
          </div>

          <p className="property-search-status" aria-live="polite">
            {searchSummary || "Choose your search criteria to get started."}
          </p>
        </form>
      </div>

      {(results || isLoading || searchError) && (
        <section
          className="fp-results"
          ref={resultsRef}
          aria-labelledby={`${uid}-results-title`}
          aria-live="polite"
        >
          <div className="fp-results-heading">
            <div>
              <p className="investment-eyebrow">PROPERTY OPPORTUNITIES</p>
              <h2 id={`${uid}-results-title`}>Search results</h2>
            </div>
            {results && (
              <p className="fp-results-count">
                Showing {results.total === 0 ? 0 : (results.page - 1) * PAGE_SIZE + 1}
                {"–"}
                {Math.min(results.page * PAGE_SIZE, results.total)} of {results.total} properties
              </p>
            )}
          </div>

          {isLoading && <p className="fp-results-message">Searching properties…</p>}
          {searchError && (
            <p className="fp-results-error" role="alert">
              {searchError}
            </p>
          )}

          {results && results.items.length > 0 && (
            <div className="fp-results-grid">
              {results.items.map((property) => (
                <article
                  className="fp-property-card"
                  key={property.property_id}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-label={`View details for ${property.property_name || "untitled property"}`}
                  onClick={(event) => openPropertyDetails(property, event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPropertyDetails(property, event.currentTarget);
                    }
                  }}
                >
                  <div className="fp-card-image">
                    <Image
                      src={property.image_url || "/realestate1.jpeg"}
                      alt={property.property_name || "Property"}
                      fill
                      sizes="(max-width: 36rem) 100vw, (max-width: 52rem) 50vw, 33vw"
                      unoptimized
                      onError={(event) => {
                        event.currentTarget.srcset = "";
                        event.currentTarget.src = "/realestate1.jpeg";
                      }}
                    />
                  </div>
                  <div className="fp-card-content">
                    <div className="fp-card-tags">
                      {property.property_type && <span>{property.property_type}</span>}
                      {property.asset_class && <span>{property.asset_class}</span>}
                    </div>
                    <h3>{property.property_name || "Untitled property"}</h3>
                    {(property.city || property.country) && (
                      <p className="fp-card-location">
                        {[property.city, property.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {property.short_description && (
                      <p className="fp-card-description">{property.short_description}</p>
                    )}
                    <dl className="fp-card-details">
                      {property.price_guide_price !== null && (
                        <div>
                          <dt>Guide price</dt>
                          <dd>
                            {formatMoney(
                              property.price_guide_price,
                              property.currency || FILTER_CURRENCY,
                            )}
                          </dd>
                        </div>
                      )}
                      {property.size !== null && (
                        <div>
                          <dt>Size</dt>
                          <dd>{property.size.toLocaleString()} {property.unit || ""}</dd>
                        </div>
                      )}
                      {property.niy_yield !== null && (
                        <div>
                          <dt>Net initial yield</dt>
                          <dd>{property.niy_yield}%</dd>
                        </div>
                      )}
                      {property.rent_income_pa !== null && (
                        <div>
                          <dt>Rent per annum</dt>
                          <dd>
                            {formatMoney(
                              property.rent_income_pa,
                              property.currency || FILTER_CURRENCY,
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}

          {results && results.items.length === 0 && !isLoading && (
            <p className="fp-results-message">
              No properties match your search. Try adjusting your filters.
            </p>
          )}

          {results && results.total_pages > 1 && (
            <nav className="fp-pagination" aria-label="Search result pages">
              <button
                type="button"
                className="fp-page-button"
                onClick={() => currentFilters && void loadProperties(currentFilters, results.page - 1)}
                disabled={results.page <= 1 || isLoading}
              >
                Previous
              </button>
              <span>
                Page {results.page} of {results.total_pages}
              </span>
              <button
                type="button"
                className="fp-page-button"
                onClick={() => currentFilters && void loadProperties(currentFilters, results.page + 1)}
                disabled={!results.has_next || isLoading}
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}

      {selectedProperty && (
        <div
          className="fp-detail-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePropertyDetails();
          }}
        >
          <aside
            className="fp-detail-panel"
            id={`${uid}-property-details`}
            ref={detailsPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${uid}-property-details-title`}
          >
            <header className="fp-detail-header">
              <h2 id={`${uid}-property-details-title`}>Property Details</h2>
              <button
                ref={closeDetailsRef}
                type="button"
                className="fp-detail-close"
                aria-label="Close property details"
                onClick={closePropertyDetails}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </header>

            <div className="fp-detail-content">
              <div className="fp-detail-image">
                <Image
                  src={selectedProperty.image_url || "/realestate1.jpeg"}
                  alt={selectedProperty.property_name || "Property"}
                  fill
                  sizes="(max-width: 36rem) 100vw, 36rem"
                  unoptimized
                  onError={(event) => {
                    event.currentTarget.srcset = "";
                    event.currentTarget.src = "/realestate1.jpeg";
                  }}
                />
              </div>
              <h3 className="fp-detail-name">
                {selectedProperty.property_name || "Untitled property"}
              </h3>

              {detailsLoading && (
                <p className="fp-detail-status" role="status">
                  Loading property details…
                </p>
              )}
              {detailsError && (
                <p className="fp-detail-error" role="alert">
                  {detailsError}
                </p>
              )}

              <dl className="fp-detail-list">
                <div><dt>City</dt><dd>{propertyDetails?.city || selectedProperty.city || "Not specified"}</dd></div>
                <div><dt>Country</dt><dd>{propertyDetails?.country || selectedProperty.country || "Not specified"}</dd></div>
                <div><dt>Region</dt><dd>{propertyDetails?.region || selectedProperty.region || "Not specified"}</dd></div>
                <div><dt>Asset class</dt><dd>{propertyDetails?.asset_class || selectedProperty.asset_class || "Not specified"}</dd></div>
                <div className="fp-detail-wide"><dt>Short description</dt><dd>{propertyDetails?.short_description || selectedProperty.short_description || "Not specified"}</dd></div>
                <div><dt>Tenure</dt><dd>{propertyDetails?.tenure || selectedProperty.tenure || "Not specified"}</dd></div>
                <div><dt>Property type</dt><dd>{propertyDetails?.property_type || selectedProperty.property_type || "Not specified"}</dd></div>
                <div><dt>Price / guide price</dt><dd>{formatOptionalMoney(propertyDetails?.price_guide_price ?? selectedProperty.price_guide_price, propertyDetails?.currency || selectedProperty.currency)}</dd></div>
                <div><dt>Net initial yield</dt><dd>{(propertyDetails?.niy_yield ?? selectedProperty.niy_yield) !== null ? `${propertyDetails?.niy_yield ?? selectedProperty.niy_yield}%` : "Not specified"}</dd></div>
                <div><dt>Price per sq ft</dt><dd>{formatOptionalMoney(propertyDetails?.price_psf ?? selectedProperty.price_psf, propertyDetails?.currency || selectedProperty.currency)}</dd></div>
                <div><dt>Size</dt><dd>{(propertyDetails?.size ?? selectedProperty.size) !== null ? `${(propertyDetails?.size ?? selectedProperty.size)?.toLocaleString("en-GB")} ${propertyDetails?.unit || selectedProperty.unit || ""}`.trim() : "Not specified"}</dd></div>
                <div><dt>Tenant</dt><dd>{propertyDetails?.tenant || selectedProperty.tenant || "Not specified"}</dd></div>
                <div><dt>Term WAULT</dt><dd>{propertyDetails?.term_wault || "Not specified"}</dd></div>
                <div><dt>Rent income p.a.</dt><dd>{formatOptionalMoney(propertyDetails?.rent_income_pa ?? selectedProperty.rent_income_pa, propertyDetails?.currency || selectedProperty.currency)}</dd></div>
                <div><dt>Rent per sq ft</dt><dd>{formatOptionalMoney(propertyDetails?.rent_psf ?? selectedProperty.rent_psf, propertyDetails?.currency || selectedProperty.currency)}</dd></div>
                {propertyDetails?.completion && (
                  <div><dt>Completion</dt><dd>{propertyDetails.completion}</dd></div>
                )}
                <div className="fp-detail-wide"><dt>Comments / other details</dt><dd>{propertyDetails?.comments_other_details || "Not specified"}</dd></div>
              </dl>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}