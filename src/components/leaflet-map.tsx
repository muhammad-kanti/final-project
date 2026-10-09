"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoCoords } from "@/types/incident";
import type { LeafletMarker, LeafletStatic } from "@/types/leaflet";
import {
  CAMPUS_CENTER,
  CAMPUS_ZOOM,
  MAP_LAYER_LABELS,
  reverseGeocode,
  searchPlaces,
  tileSourcesFor,
  type MapLayer,
  type PlaceResult,
} from "@/lib/esri";

interface MapProps {
  center?: GeoCoords | null;
  onLocationChange?: (loc: GeoCoords, address?: string | null) => void;
  onManualDescription?: (desc: string) => void;
}

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const GEOCODE_DEBOUNCE_MS = 450;

function loadLeaflet(): Promise<LeafletStatic> {
  if (typeof window !== "undefined" && window.L) return Promise.resolve(window.L);

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const onLoad = () => resolve(window.L);
    const onError = () => reject(new Error("Leaflet failed to load"));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onError);
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = onLoad;
    script.onerror = onError;
    document.body.appendChild(script);
  });
}

export function MapPicker({ center, onLocationChange, onManualDescription }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<ReturnType<LeafletStatic["map"]> | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const baseLayersRef = useRef<ReturnType<LeafletStatic["tileLayer"]>[]>([]);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocoded = useRef("");
  const latestCallback = useRef(onLocationChange);

  const [layer, setLayer] = useState<MapLayer>("street");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    latestCallback.current = onLocationChange;
  }, [onLocationChange]);

  const emitLocation = useCallback((c: GeoCoords) => {
    const key = `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
    if (key === lastGeocoded.current) return;
    lastGeocoded.current = key;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      const label = await reverseGeocode(c);
      latestCallback.current?.(c, label);
    }, GEOCODE_DEBOUNCE_MS);
  }, []);

  const moveMarker = useCallback(
    (c: GeoCoords) => {
      const map = mapInstance.current;
      const L = window.L;
      if (!map || !L) return;

      if (markerRef.current) {
        markerRef.current.setLatLng({ lat: c.lat, lng: c.lng });
      } else {
        const marker = L.marker({ lat: c.lat, lng: c.lng }, { draggable: true }).addTo(map);
        marker.on("dragend", (e) => emitLocation(e.target.getLatLng()));
        markerRef.current = marker;
      }
      map.setView({ lat: c.lat, lng: c.lng }, Math.max(map.getZoom(), CAMPUS_ZOOM));
    },
    [emitLocation]
  );

  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current) return;

    void loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstance.current) return;
        const map = L.map(mapRef.current).setView(
          { lat: CAMPUS_CENTER.lat, lng: CAMPUS_CENTER.lng },
          CAMPUS_ZOOM
        );

        baseLayersRef.current = tileSourcesFor("street").map((src) =>
          L.tileLayer(src.url, {
            attribution: src.attribution || undefined,
            maxNativeZoom: src.maxNativeZoom,
            maxZoom: 20,
          })
        );
        for (const tl of baseLayersRef.current) tl.addTo(map);

        map.on("click", (e) => {
          const c = { lat: e.latlng.lat, lng: e.latlng.lng };
          moveMarker(c);
          emitLocation(c);
        });

        mapInstance.current = map;
      })
      .catch(() => {
        if (!cancelled) setMapError("Map could not be loaded. Check your connection.");
      });

    return () => {
      cancelled = true;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [emitLocation, moveMarker]);

  // Adopt coordinates that arrived from outside the map. emitLocation is keyed
  // on the rounded position, so the state update this triggers cannot feed back
  // into another geocode request.
  useEffect(() => {
    if (!center || !center.lat || !center.lng) return;
    moveMarker(center);
    emitLocation(center);
  }, [center, moveMarker, emitLocation]);

  function changeLayer(next: MapLayer) {
    const map = mapInstance.current;
    const L = window.L;
    if (!map || !L) return;

    for (const tl of baseLayersRef.current) map.removeLayer(tl);
    baseLayersRef.current = tileSourcesFor(next).map((src) =>
      L.tileLayer(src.url, {
        attribution: src.attribution || undefined,
        maxNativeZoom: src.maxNativeZoom,
        maxZoom: 20,
      }).addTo(map)
    );
    setLayer(next);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("Geolocation not supported");
      return;
    }
    setStatus("Getting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        moveMarker(c);
        emitLocation(c);
        setStatus("");
      },
      (err) => setStatus(err.message || "Failed to get location"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    setStatus("");
    const found = await searchPlaces(search);
    setResults(found);
    setSearching(false);
    if (found.length === 0) setStatus("No matching places found. Try a different description.");
  }

  function chooseResult(r: PlaceResult) {
    moveMarker(r);
    lastGeocoded.current = `${r.lat.toFixed(6)},${r.lng.toFixed(6)}`;
    latestCallback.current?.({ lat: r.lat, lng: r.lng }, r.label);
    setResults([]);
    setSearch("");
  }

  function handleManualBlur() {
    if (manual.trim()) onManualDescription?.(manual.trim());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
        >
          Use my current location
        </button>
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search place (e.g. NSUK Faculty of Engineering)"
            aria-label="Search for a place"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded-xl border border-violet-600 bg-white px-3 py-2 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-50 disabled:opacity-50"
          >
            {searching ? "..." : "Search"}
          </button>
        </form>
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                onClick={() => chooseResult(r)}
                className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-violet-50"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {status && <p className="text-sm text-gray-600">{status}</p>}
      {mapError && <p className="text-sm text-red-600">{mapError}</p>}

      <div className="relative">
        <div ref={mapRef} className="h-64 w-full rounded-2xl border border-gray-200 shadow-sm" />
        <div className="absolute right-2 top-2 flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {(Object.keys(MAP_LAYER_LABELS) as MapLayer[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => changeLayer(key)}
              aria-pressed={layer === key}
              className={`px-2 py-1 text-xs font-medium transition ${
                layer === key
                  ? "bg-violet-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {MAP_LAYER_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="manual-location" className="mb-1 block text-sm font-medium text-gray-900">
          Or describe location manually
        </label>
        <textarea
          id="manual-location"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onBlur={handleManualBlur}
          rows={2}
          placeholder="e.g. Behind Block A, Male Hostel, NSUK"
          className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
        />
        <p className="mt-1 text-xs text-gray-500">Works well if GPS is poor or indoors.</p>
      </div>
    </div>
  );
}