"use client";

import { useId, useState, type FormEvent } from "react";
import "./find-property.css";

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

const CURRENCIES = [
  { code: "GBP" },
  { code: "USD" },
  { code: "EUR" },
  { code: "AUD" },
  { code: "CAD" },
  { code: "NZD" },
  { code: "SGD" },
  { code: "AED" },
  { code: "SAR" },
  { code: "QAR" },
  { code: "ZAR" },
  { code: "KES" },
  { code: "MAD" },
  { code: "JPY" },
  { code: "CNY" },
  { code: "INR" },
  { code: "THB" },
  { code: "BRL" },
  { code: "CLP" },
];

function currencyLabel(code: string) {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(code);
    return name ? `${code} – ${name}` : code;
  } catch {
    return code;
  }
}

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({
  value: c.code,
  label: currencyLabel(c.code),
}));

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

type Props = {
  region?: string;
  /** Optional counts shown beside each asset class, e.g. { "Offices": 12, "All asset classes": 95 } */
  assetClassCounts?: Record<string, number>;
  onSearch?: (filters: SearchFilters) => void;
};

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
  const [currency, setCurrency] = useState("GBP");
  const [ranges, setRanges] = useState<Record<RangeKey, RangeInputValue>>({
    price: { min: "", max: "" },
    rent: { min: "", max: "" },
    size: { min: "", max: "" },
    yield: { min: "", max: "" },
  });
  const [searchSummary, setSearchSummary] = useState("");

  const money = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
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

  function changeCurrency(next: string) {
    setCurrency(next);
    setRanges((r) => ({
      ...r,
      price: { min: "", max: "" },
      rent: { min: "", max: "" },
    }));
  }

  function reset() {
    setLoc({ source: region, region: startRegion, country: "", city: "" });
    setPropertyType(ALL_TYPES);
    setAssetClass(ALL_CLASSES);
    setPropertyName("");
    setCurrency("GBP");
    setRanges({
      price: { min: "", max: "" },
      rent: { min: "", max: "" },
      size: { min: "", max: "" },
      yield: { min: "", max: "" },
    });
    setSearchSummary("");
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
      currency,
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
                <div className="fp-currency">
                  <PillSelect
                    id={`${uid}-currency`}
                    label="Currency for price and rent"
                    value={currency}
                    defaultValue="GBP"
                    options={CURRENCY_OPTIONS}
                    onChange={changeCurrency}
                  />
                </div>
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
    </div>
  );
}