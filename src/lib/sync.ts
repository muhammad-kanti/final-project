"use client";

import { idbEnqueueOutbox, idbGetOutbox, idbRemoveOutbox, idbUpdateOutbox } from "./idb";

export async function syncOutbox() {
  const items = await idbGetOutbox();
  for (const item of items) {
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (res.ok) {
        await idbRemoveOutbox(item.id);
      } else {
        const next = { ...item, retries: item.retries + 1, lastError: String(res.status) };
        await idbUpdateOutbox(next);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "network";
      const next = { ...item, retries: item.retries + 1, lastError: msg };
      await idbUpdateOutbox(next);
    }
  }
}

export async function enqueue(payload: unknown) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  await idbEnqueueOutbox({ id, payload, createdAt: new Date().toISOString(), retries: 0, lastError: null });
}
