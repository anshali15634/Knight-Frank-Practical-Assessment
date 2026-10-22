"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import "./property-collection.css";
import "@/app/landing/find-property/find-property.css";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
const FILTER_CURRENCY = "AED";

export type Property = {
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

type Props = {
  properties?: Property[];
  savedOnly?: boolean;
};

function isProperty(value: unknown): value is Property {
  return (
    typeof value === "object" &&
    value !== null &&
    "property_id" in value &&
    typeof value.property_id === "string"
  );
}

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

function errorMessage(status: number, action: string) {
  return status === 401
    ? "Your session has expired. Sign in again to manage saved properties."
    : `${action} (${status}).`;
}

export default function PropertyCollection({
  properties = [],
  savedOnly = false,
}: Props) {
  const uid = useId();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [favoritePendingIds, setFavoritePendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [favoriteError, setFavoriteError] = useState("");
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(savedOnly);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(
    null,
  );
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAuthToken(window.sessionStorage.getItem("kf_auth_token"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    const controller = new AbortController();
    async function loadFavorites() {
      try {
        const path = savedOnly
          ? "/favorites/properties"
          : "/favorites";
        const response = await fetch(`${API_URL}/api/v1/properties${path}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(errorMessage(response.status, "Could not load saved properties"));
        }

        const data: unknown = await response.json();
        if (savedOnly) {
          if (!Array.isArray(data) || !data.every(isProperty)) {
            throw new Error("The saved properties response was invalid.");
          }
          if (!controller.signal.aborted) {
            setSavedProperties(data);
            setFavoriteIds(new Set(data.map((property) => property.property_id)));
          }
        } else {
          if (
            !Array.isArray(data) ||
            !data.every((id): id is string => typeof id === "string")
          ) {
            throw new Error("The saved properties response was invalid.");
          }
          if (!controller.signal.aborted) setFavoriteIds(new Set(data));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setFavoriteError(
            error instanceof Error
              ? error.message
              : "Could not load saved properties.",
          );
        }
      } finally {
        if (savedOnly && !controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadFavorites();
    return () => controller.abort();
  }, [authToken, savedOnly]);

  useEffect(() => {
    if (!selectedProperty) return;

    const controller = new AbortController();
    detailsController.current = controller;
    const propertyId = selectedProperty.property_id;

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

  async function toggleFavorite(property: Property) {
    const propertyId = property.property_id;
    if (!authToken) {
      setFavoriteError("Sign in to save properties to your favourites.");
      return;
    }

    const isSaved = favoriteIds.has(propertyId);
    setFavoriteError("");
    setFavoritePendingIds((pending) => new Set(pending).add(propertyId));
    if (savedOnly && isSaved) {
      setRemovingIds((removing) => new Set(removing).add(propertyId));
    }

    try {
      const response = await fetch(
        `${API_URL}/api/v1/properties/favorites/${encodeURIComponent(propertyId)}`,
        {
          method: isSaved ? "DELETE" : "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      if (!response.ok) {
        throw new Error(errorMessage(response.status, "Could not update saved properties"));
      }

      setFavoriteIds((saved) => {
        const next = new Set(saved);
        if (isSaved) next.delete(propertyId);
        else next.add(propertyId);
        return next;
      });

      if (savedOnly && isSaved) {
        await new Promise((resolve) => window.setTimeout(resolve, 240));
        setSavedProperties((saved) =>
          saved.filter((item) => item.property_id !== propertyId),
        );
        setRemovingIds((removing) => {
          const next = new Set(removing);
          next.delete(propertyId);
          return next;
        });
      }
    } catch (error) {
      setRemovingIds((removing) => {
        const next = new Set(removing);
        next.delete(propertyId);
        return next;
      });
      setFavoriteError(
        error instanceof Error
          ? error.message
          : "Could not update saved properties.",
      );
    } finally {
      setFavoritePendingIds((pending) => {
        const next = new Set(pending);
        next.delete(propertyId);
        return next;
      });
    }
  }

  const visibleProperties = savedOnly ? savedProperties : properties;

  return (
    <div className="fp-property-collection">
      {favoriteError && (
        <p className="fp-favorite-error" role="alert">
          {favoriteError}
        </p>
      )}

      {isLoading && authToken && <p className="fp-results-message">Loading saved properties…</p>}
      {!favoriteError && savedOnly && !authToken && (
        <p className="fp-results-message">Sign in to view your saved properties.</p>
      )}

      {visibleProperties.length > 0 && (
        <div className="fp-results-grid">
          {visibleProperties.map((property) => {
            const isFavorite = favoriteIds.has(property.property_id);
            const isRemoving = removingIds.has(property.property_id);
            return (
              <div
                className="fp-property-card-shell"
                data-removing={isRemoving || undefined}
                key={property.property_id}
              >
                <article
                  className="fp-property-card"
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
                          <dd>{formatMoney(property.price_guide_price, property.currency || FILTER_CURRENCY)}</dd>
                        </div>
                      )}
                      {property.size !== null && (
                        <div><dt>Size</dt><dd>{property.size.toLocaleString()} {property.unit || ""}</dd></div>
                      )}
                      {property.niy_yield !== null && (
                        <div><dt>Net initial yield</dt><dd>{property.niy_yield}%</dd></div>
                      )}
                      {property.rent_income_pa !== null && (
                        <div>
                          <dt>Rent per annum</dt>
                          <dd>{formatMoney(property.rent_income_pa, property.currency || FILTER_CURRENCY)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </article>
                <button
                  type="button"
                  className="fp-favorite-button"
                  aria-label={
                    isFavorite
                      ? `Remove ${property.property_name || "property"} from favourites`
                      : `Save ${property.property_name || "property"} to favourites`
                  }
                  aria-pressed={isFavorite}
                  disabled={favoritePendingIds.has(property.property_id)}
                  onClick={() => void toggleFavorite(property)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill={isFavorite ? "currentColor" : "none"}
                  >
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && savedOnly && authToken && !favoriteError && !visibleProperties.length && (
        <div className="fp-saved-empty">
          <p className="fp-results-message">You haven’t saved any properties yet.</p>
          <Link href="/landing#find-property" className="portal-placeholder-link">
            Find a Property
          </Link>
        </div>
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
              {detailsLoading && <p className="fp-detail-status" role="status">Loading property details…</p>}
              {detailsError && <p className="fp-detail-error" role="alert">{detailsError}</p>}

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
                {propertyDetails?.completion && <div><dt>Completion</dt><dd>{propertyDetails.completion}</dd></div>}
                <div className="fp-detail-wide"><dt>Comments / other details</dt><dd>{propertyDetails?.comments_other_details || "Not specified"}</dd></div>
              </dl>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
