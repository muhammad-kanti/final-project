"use client";

import { useEffect, useRef } from "react";
import type { GeoCoords } from "@/types/incident";

declare global {
  interface Window {
    L: any;
  }
}

export function MapView({ coords, address }: { coords: GeoCoords | null; address?: string | null }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const load = () => {
      if (window.L && !mapInstance.current) {
        const L = window.L;
        const center = coords ? [coords.lat, coords.lng] : [8.8475, 7.8758];
        const map = L.map(mapRef.current).setView(center as any, coords ? 16 : 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        mapInstance.current = map;
        if (coords) {
          markerRef.current = L.marker([coords.lat, coords.lng]).addTo(map).bindPopup(address || "Reporter Location").openPopup();
        }
      } else if (!window.L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.onload = load;
        document.body.appendChild(script);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (mapInstance.current && window.L && coords) {
      const L = window.L;
      const pos = [coords.lat, coords.lng];
      mapInstance.current.setView(pos, 16);
      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
        if (address) markerRef.current.bindPopup(address).openPopup();
      } else {
        markerRef.current = L.marker(pos).addTo(mapInstance.current).bindPopup(address || "Reporter Location").openPopup();
      }
    }
  }, [coords, address]);

  return <div ref={mapRef} className="h-64 w-full rounded-2xl border border-gray-200 shadow-sm" />;
}
