import type { Incident } from "@/types/incident";
import { readJson, updateJson } from "@/lib/store";

const FILE = "incidents.json";

interface IncidentStore {
  incidents: Incident[];
}

const EMPTY: IncidentStore = { incidents: [] };

function byNewest(a: Incident, b: Incident): number {
  return a.createdAt < b.createdAt ? 1 : -1;
}

export async function getIncidents(): Promise<Incident[]> {
  const store = await readJson<IncidentStore>(FILE, EMPTY);
  return [...store.incidents].sort(byNewest);
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const store = await readJson<IncidentStore>(FILE, EMPTY);
  return store.incidents.find((i) => i.id === id) ?? null;
}

export async function createIncident(incident: Incident): Promise<Incident> {
  await updateJson<IncidentStore>(FILE, EMPTY, (store) => {
    store.incidents.push(incident);
  });
  return incident;
}

export async function updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
  const store = await updateJson<IncidentStore>(FILE, EMPTY, (s) => {
    const idx = s.incidents.findIndex((i) => i.id === id);
    if (idx !== -1) {
      s.incidents[idx] = { ...s.incidents[idx], ...updates };
    }
  });
  return store.incidents.find((i) => i.id === id) ?? null;
}

export async function deleteIncident(id: string): Promise<boolean> {
  const result = { removed: false };
  await updateJson<IncidentStore>(FILE, EMPTY, (store) => {
    const next = store.incidents.filter((i) => i.id !== id);
    result.removed = next.length !== store.incidents.length;
    store.incidents = next;
  });
  return result.removed;
}