"use client";

import { useState, type FormEvent } from "react";

type Props = {
  region: string;
};

export default function AssetsPropertiesSearchMain({ region }: Props) {
  const [locationState, setLocationState] = useState({ region, value: region });
  const [propertyType, setPropertyType] = useState("All property types");
  const [budget, setBudget] = useState("Any budget");
  const [searchSummary, setSearchSummary] = useState("");
  const location =
    locationState.region === region ? locationState.value : region;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const criteria = [
      location.trim() || "all locations",
      propertyType.toLowerCase(),
      budget.toLowerCase(),
    ];
    setSearchSummary(`Search criteria: ${criteria.join(" · ")}`);
  }

  return (
    <div className="property-search-page">
      <div className="property-search-heading">
        <p className="investment-eyebrow">KNIGHT FRANK · PROPERTY SEARCH</p>
        <h2>Find your next investment</h2>
        <p>
          Search global property opportunities by location, asset type, and
          budget.
        </p>
      </div>

      <form className="property-search-form" onSubmit={handleSubmit}>
        <label>
          Location
          <input
            type="search"
            value={location}
            onChange={(event) =>
              setLocationState({ region, value: event.target.value })
            }
            placeholder="City, country, or region"
          />
        </label>

        <label>
          Property type
          <select
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
          >
            <option>All property types</option>
            <option>Residential</option>
            <option>Commercial</option>
            <option>Land</option>
          </select>
        </label>

        <label>
          Budget
          <select
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
          >
            <option>Any budget</option>
            <option>Under £1 million</option>
            <option>£1 million – £5 million</option>
            <option>Over £5 million</option>
          </select>
        </label>

        <button type="submit">Search properties</button>
      </form>

      <p className="property-search-status" aria-live="polite">
        {searchSummary || "Choose your search criteria to get started."}
      </p>
    </div>
  );
}
