import type { GeoCoords } from "@/types/incident";

/**
 * Map data comes from Esri's public ArcGIS Online services. These tile and
 * geocoding endpoints are keyless, cover Nigeria far better than OpenStreetMap
 * and Nominatim, and send permissive CORS headers.
 */

export type MapLayer = "street" | "satellite" | "hybrid";

export const CAMPUS_CENTER: GeoCoords = { lat: 8.8475, lng: 7.8758 };
const CAMPUS_ZOOM = 16;
const NIGERIA = "NGA";

const TILE = {
  street:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  imagery:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  labels:
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
} as const;

const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI";

export interface TileSource {
  url: string;
  attribution: string;
  maxNativeZoom: number;
}

/**
 * Esri addresses tiles as {z}/{y}/{x}, the opposite row/column order to the
 * {z}/{x}/{y} convention used by most other providers.
 */
export function tileSourcesFor(layer: MapLayer): TileSource[] {
  if (layer === "satellite") {
    return [{ url: TILE.imagery, attribution: ESRI_ATTRIBUTION, maxNativeZoom: 19 }];
  }
  if (layer === "hybrid") {
    return [
      { url: TILE.imagery, attribution: ESRI_ATTRIBUTION, maxNativeZoom: 19 },
      { url: TILE.labels, attribution: "", maxNativeZoom: 19 },
    ];
  }
  return [{ url: TILE.street, attribution: ESRI_ATTRIBUTION, maxNativeZoom: 18 }];
}

export const MAP_LAYER_LABELS: Record<MapLayer, string> = {
  street: "Street",
  satellite: "Satellite",
  hybrid: "Satellite + labels",
};

const GEOCODE_BASE =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function reverseGeocode(coords: GeoCoords): Promise<string | null> {
  try {
    const url = `${GEOCODE_BASE}/reverseGeocode?f=json&outSR=4326&location=${coords.lng},${coords.lat}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address;
    if (!a) return null;

    const street = clean(a.Address);
    const locality = [clean(a.City) || clean(a.PlaceName), clean(a.Region)]
      .filter(Boolean)
      .join(", ");
    const label = [street, locality].filter(Boolean).join(", ");
    return label || clean(a.LongLabel) || clean(a.Match_addr) || null;
  } catch {
    return null;
  }
}

export interface PlaceResult {
  lat: number;
  lng: number;
  label: string;
  score: number;
}

interface EsriCandidate {
  location?: { x?: number; y?: number };
  score?: number;
  attributes?: {
    Match_addr?: string;
    PlaceName?: string;
    Region?: string;
    City?: string;
  };
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    f: "json",
    singleLine: trimmed,
    outFields: "Match_addr,PlaceName,Region,City,Country",
    maxLocations: "5",
    countryCode: NIGERIA,
    location: `${CAMPUS_CENTER.lng},${CAMPUS_CENTER.lat}`,
  });

  try {
    const res = await fetch(`${GEOCODE_BASE}/findAddressCandidates?${params.toString()}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const candidates: EsriCandidate[] = Array.isArray(data?.candidates) ? data.candidates : [];

    return candidates
      .map((c) => {
        const lat = Number(c.location?.y);
        const lng = Number(c.location?.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const attrs = c.attributes ?? {};
        const street = clean(attrs.Match_addr);
        const locality = [clean(attrs.City) || clean(attrs.PlaceName), clean(attrs.Region)]
          .filter(Boolean)
          .join(", ");
        const label = [street, locality].filter(Boolean).join(", ") || street;
        return { lat, lng, label, score: Number(c.score) || 0 };
      })
      .filter((p): p is PlaceResult => p !== null && p.label.length > 0);
  } catch {
    return [];
  }
}

export { CAMPUS_ZOOM };