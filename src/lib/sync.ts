"use client";

import { idbEnqueueOutbox, idbGetOutbox, idbRemoveOutbox, idbUpdateOutbox, idbDeleteIncident } from "./idb";
import type { Incident } from "@/types/incident";

export interface SyncedReport {
  placeholderId: string;
  incident: Incident;
}

/**
 * Flushes queued reports. The local placeholder is written under the same id as
 * the outbox entry so that a queued report can be withdrawn before it is sent,
 * and so it can be swapped for the server record without leaving a duplicate.
 */
export async function syncOutbox(): Promise<SyncedReport[]> {
  const items = await idbGetOutbox();
  const synced: SyncedReport[] = [];

  for (const item of items) {
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        const data = await res.json();
        await idbRemoveOutbox(item.id);
        if (data?.incident) {
          await idbDeleteIncident(item.id);
          synced.push({ placeholderId: item.id, incident: data.incident as Incident });
        }
      } else if (res.status === 401 || res.status === 403) {
        // The queued report will never be accepted in this state; drop it
        // rather than retrying forever.
        await idbRemoveOutbox(item.id);
        await idbDeleteIncident(item.id);
      } else {
        await idbUpdateOutbox({ ...item, retries: item.retries + 1, lastError: String(res.status) });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "network";
      await idbUpdateOutbox({ ...item, retries: item.retries + 1, lastError: msg });
    }
  }

  return synced;
}

export async function enqueue(payload: unknown, id: string) {
  await idbEnqueueOutbox({ id, payload, createdAt: new Date().toISOString(), retries: 0, lastError: null });
}

export async function dropQueuedReport(id: string) {
  await idbRemoveOutbox(id);
  await idbDeleteIncident(id);
}