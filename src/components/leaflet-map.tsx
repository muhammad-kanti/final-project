"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoCoords } from "@/types/incident";

declare global {
  interface Window {
    L: any;
  }
}

interface MapProps {
  center?: GeoCoords | null;
  onLocationChange?: (loc: GeoCoords, address?: string | null) => void;
  onManualDescription?: (desc: string) => void;
}

export function MapPicker({ center, onLocationChange, onManualDescription }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const loadLeaflet = () => {
      if (window.L) {
        initMap();
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    };

    loadLeaflet();
  }, []);

  const reverseGeocode = async (c: GeoCoords) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${c.lat}&lon=${c.lng}`,
        {
          headers: { "Accept-Language": "en" },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.display_name || null;
        onLocationChange?.(c, addr);
        return;
      }
    } catch (e) {
      // ignore
    }
    onLocationChange?.(c, null);
  };

  const initMap = () => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    const map = L.map(mapRef.current).setView([8.8475, 7.8758], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    mapInstance.current = map;

    map.on("click", (e: any) => {
      const c = { lat: e.latlng.lat, lng: e.latlng.lng };
      setMarker(c);
      void reverseGeocode(c);
    });
  };

  const setMarker = (c: GeoCoords) => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;
    if (markerRef.current) {
      markerRef.current.setLatLng([c.lat, c.lng]);
    } else {
      markerRef.current = L.marker([c.lat, c.lng], { draggable: true }).addTo(mapInstance.current);
      markerRef.current.on("dragend", (e: any) => {
        const ll = e.target.getLatLng();
        const cc = { lat: ll.lat, lng: ll.lng };
        void reverseGeocode(cc);
      });
    }
    mapInstance.current.setView([c.lat, c.lng], Math.max(mapInstance.current.getZoom(), 16));
  };

  useEffect(() => {
    if (center && center.lat && center.lng) {
      setMarker(center);
      void reverseGeocode(center);
    }
  }, [center]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus("Geolocation not supported");
      return;
    }
    setStatus("Getting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setMarker(c);
        void reverseGeocode(c);
        setStatus("");
      },
      (err) => {
        setStatus(err.message || "Failed to get location");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    setStatus("Searching...");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(search.trim())}`,
        {
          headers: { "Accept-Language": "en" },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const first = data[0];
          const c = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
          setMarker(c);
          onLocationChange?.(c, first.display_name || null);
          setStatus("");
          return;
        }
      }
      setStatus("No results found");
    } catch {
      setStatus("Search failed");
    }
  };

  const handleManualBlur = () => {
    if (manual.trim()) {
      onManualDescription?.(manual.trim());
    }
  };

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
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search place (e.g. NSUK Faculty of Engineering)"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
          />
          <button
            type="submit"
            className="rounded-xl border border-violet-600 bg-white px-3 py-2 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-50"
          >
            Search
          </button>
        </form>
      </div>
      {status && <p className="text-sm text-gray-600">{status}</p>}
      <div ref={mapRef} className="h-64 w-full rounded-2xl border border-gray-200 shadow-sm" />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-900">Or describe location manually</label>
        <textarea
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
