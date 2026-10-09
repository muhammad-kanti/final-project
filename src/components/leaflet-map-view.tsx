"use client";

import { useEffect, useRef } from "react";
import type { GeoCoords } from "@/types/incident";
import type { LeafletMarker, LeafletStatic } from "@/types/leaflet";
import { CAMPUS_CENTER, CAMPUS_ZOOM, tileSourcesFor } from "@/lib/esri";

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

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

export function MapView({ coords, address }: { coords: GeoCoords | null; address?: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<ReturnType<LeafletStatic["map"]> | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current) return;

    void loadLeaflet()
      .then((L) => {
        if (cancelled || !mapRef.current || mapInstance.current) return;

        const center = coords
          ? { lat: coords.lat, lng: coords.lng }
          : { lat: CAMPUS_CENTER.lat, lng: CAMPUS_CENTER.lng };
        const map = L.map(mapRef.current).setView(center, coords ? CAMPUS_ZOOM : 13);

        for (const src of tileSourcesFor("hybrid")) {
          L.tileLayer(src.url, {
            attribution: src.attribution || undefined,
            maxNativeZoom: src.maxNativeZoom,
            maxZoom: 20,
          }).addTo(map);
        }

        mapInstance.current = map;
        if (coords) {
          markerRef.current = L.marker({ lat: coords.lat, lng: coords.lng })
            .addTo(map)
            .bindPopup(address || "Reporter location");
        }
      })
      .catch(() => {
        /* the map area simply stays blank */
      });

    return () => {
      cancelled = true;
    };
    // Built once; later prop changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const L = window.L;
    if (!map || !L || !coords) return;

    const pos = { lat: coords.lat, lng: coords.lng };
    map.setView(pos, CAMPUS_ZOOM);
    const label = address || "Reporter location";
    if (markerRef.current) {
      markerRef.current.setLatLng(pos).bindPopup(label).openPopup();
    } else {
      markerRef.current = L.marker(pos).addTo(map).bindPopup(label).openPopup();
    }
  }, [coords, address]);

  return <div ref={mapRef} className="h-64 w-full rounded-2xl border border-gray-200 shadow-sm" />;
}