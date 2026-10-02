"use client";

import type { Incident } from "@/types/incident";
import { useCallback, useEffect, useState } from "react";

export function useIncidents(initial: Incident[] = []) {
  const [incidents, setIncidents] = useState<Incident[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const data = await res.json();
      setIncidents(data.incidents ?? []);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to fetch";
        setError(msg);
      } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/incidents/stream");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (Array.isArray(data.incidents)) setIncidents(data.incidents);
        } catch {}
      };
      es.onerror = () => {
        es?.close();
      };
    } catch {}
    return () => {
      es?.close();
    };
  }, []);

  return { incidents, setIncidents, loading, error, refresh };
}
