import { promises as fs } from "fs";
import path from "path";
import type { Incident } from "@/types/incident";

const DATA_DIR = path.resolve(process.cwd(), "data");
const INCIDENTS_FILE = path.join(DATA_DIR, "incidents.json");

export interface Store {
  incidents: Incident[];
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(INCIDENTS_FILE);
  } catch {
    const initial: Store = { incidents: [] };
    await fs.writeFile(INCIDENTS_FILE, JSON.stringify(initial, null, 2));
  }
}

export async function readStore(): Promise<Store> {
  await ensureStore();
  const raw = await fs.readFile(INCIDENTS_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Store;
    if (!parsed.incidents) parsed.incidents = [];
    return parsed;
  } catch {
    const fallback: Store = { incidents: [] };
    await fs.writeFile(INCIDENTS_FILE, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

export async function writeStore(store: Store): Promise<void> {
  await ensureStore();
  await fs.writeFile(INCIDENTS_FILE, JSON.stringify(store, null, 2));
}

export async function getIncidents(): Promise<Incident[]> {
  const store = await readStore();
  return store.incidents.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const store = await readStore();
  return store.incidents.find((i) => i.id === id) ?? null;
}

export async function createIncident(incident: Incident): Promise<Incident> {
  const store = await readStore();
  store.incidents.push(incident);
  await writeStore(store);
  return incident;
}

export async function updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
  const store = await readStore();
  const idx = store.incidents.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  store.incidents[idx] = { ...store.incidents[idx], ...updates };
  await writeStore(store);
  return store.incidents[idx];
}

export async function deleteIncident(id: string): Promise<boolean> {
  const store = await readStore();
  const before = store.incidents.length;
  store.incidents = store.incidents.filter((i) => i.id !== id);
  if (store.incidents.length === before) return false;
  await writeStore(store);
  return true;
}
