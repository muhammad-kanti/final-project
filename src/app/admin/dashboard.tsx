"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Incident, IncidentStatus, GeoCoords } from "@/types/incident";
import { useIncidents } from "@/hooks/use-incidents";
import { useOnline } from "@/hooks/use-online";
import { MapView } from "@/components/leaflet-map-view";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AdminDashboard({ name }: { name: string }) {
  const router = useRouter();
  const { incidents, refresh } = useIncidents();
  const online = useOnline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editAddr, setEditAddr] = useState("");
  const [editLocDesc, setEditLocDesc] = useState("");
  const [editCoords, setEditCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derived rather than mirrored, so the live feed is the single source of truth
  // and a deleted report disappears from the detail pane on its own.
  const selected = useMemo(
    () => incidents.find((i) => i.id === selectedId) ?? null,
    [incidents, selectedId]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectReport = useCallback((incident: Incident) => {
    setSelectedId(incident.id);
    setEditDesc(incident.description || "");
    setEditAddr(incident.location.address || "");
    setEditLocDesc(incident.location.description || "");
    setEditCoords(incident.location.coords);
    setEditMode(false);
    setError(null);
  }, []);

  async function patch(id: string, body: unknown) {
    const res = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
  }

  async function updateStatus(id: string, status: IncidentStatus) {
    setUpdating(true);
    setError(null);
    try {
      const current = incidents.find((i) => i.id === id);
      const notes = [...(current?.notes ?? [])];
      if (note.trim()) {
        notes.push(`${new Date().toLocaleString()}: ${note.trim()} [Status -> ${status}]`);
        setNote("");
      }
      await patch(id, { status, notes });
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  async function saveEdits() {
    if (!selected) return;
    setUpdating(true);
    setError(null);
    try {
      await patch(selected.id, {
        description: editDesc.trim() || null,
        location: {
          coords: editCoords,
          address: editAddr.trim() || null,
          description: editLocDesc.trim() || null,
          source: selected.location.source,
        },
      });
      await refresh();
      setEditMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteReport() {
    if (!selected) return;
    if (!confirm("Delete this report? This removes it for the reporter as well.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/incidents/${selected.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to delete (${res.status})`);
      }
      setSelectedId(null);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete report");
    } finally {
      setDeleting(false);
    }
  }

  async function addNote() {
    if (!selected || !note.trim()) return;
    setUpdating(true);
    setError(null);
    try {
      const notes = [...(selected.notes ?? []), `${new Date().toLocaleString()}: ${note.trim()}`];
      await patch(selected.id, { notes });
      await refresh();
      setNote("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add note");
    } finally {
      setUpdating(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const stats = {
    pending: incidents.filter((i) => i.status === "pending").length,
    active: incidents.filter((i) => i.status === "acknowledged" || i.status === "in_progress").length,
    resolved: incidents.filter((i) => i.status === "resolved").length,
    critical: incidents.filter((i) => i.priority === "critical").length,
    total: incidents.length,
  };

  const priorityColor = (p: string) => {
    if (p === "critical") return "bg-red-100 text-red-800 border-red-200";
    if (p === "high") return "bg-orange-100 text-orange-800 border-orange-200";
    if (p === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const statusColor = (s: string) => {
    if (s === "pending") return "bg-red-100 text-red-800";
    if (s === "acknowledged") return "bg-orange-100 text-orange-800";
    if (s === "in_progress") return "bg-blue-100 text-blue-800";
    if (s === "resolved") return "bg-green-100 text-green-800";
    if (s === "false_alarm") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-700">
              <span className="text-sm font-bold text-white">NSUK</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Admin Dashboard - Emergency Response</h1>
              <p className="text-xs text-gray-600">Nasarawa State University, Keffi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {online ? "Live (SSE)" : "Offline"}
            </span>
            <span className="hidden text-sm text-gray-700 sm:inline">{name}</span>
            <button
              onClick={signOut}
              className="rounded-xl border border-violet-700 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
            >
              Sign out
            </button>
            <Link
              href="/"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reporter view
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
        <section className="space-y-6 lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pending" value={stats.pending} color="bg-red-600" />
            <StatCard label="Active" value={stats.active} color="bg-orange-600" />
            <StatCard label="Resolved" value={stats.resolved} color="bg-green-600" />
            <StatCard label="Critical" value={stats.critical} color="bg-violet-600" />
            <div className="col-span-2 rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-300">Total Reports</p>
              <p className="mt-1 text-3xl font-bold text-white">{stats.total}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">All Reports</h2>
              <button onClick={() => void refresh()} className="text-sm font-medium text-violet-700 hover:text-violet-800">
                Refresh
              </button>
            </div>
            <ul className="max-h-[calc(100vh-440px)] space-y-2 overflow-y-auto">
              {incidents.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => selectReport(i)}
                    className={`w-full rounded-xl border p-3 text-left transition hover:bg-violet-50 ${
                      selected?.id === i.id
                        ? "border-violet-600 bg-violet-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold capitalize text-gray-900">{i.emergencyType}</p>
                        <p className="text-xs text-gray-600">{new Date(i.createdAt).toLocaleString()}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(i.status)}`}
                      >
                        {i.status.replace("_", " ")}
                      </span>
                    </div>
                    {i.reportedBy && <p className="mt-1 text-xs text-gray-500">By {i.reportedBy}</p>}
                    {i.location.address && (
                      <p className="mt-2 truncate text-xs font-medium text-gray-900">{i.location.address}</p>
                    )}
                    {i.location.description && (
                      <p className="mt-1 truncate text-xs text-gray-700">{i.location.description}</p>
                    )}
                    <span
                      className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${priorityColor(i.priority)}`}
                    >
                      {i.priority}
                    </span>
                  </button>
                </li>
              ))}
              {incidents.length === 0 && <li className="py-4 text-center text-sm text-gray-600">No reports yet</li>}
            </ul>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {selected ? (
              <div className="space-y-6">
                {error && (
                  <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold capitalize text-gray-900">{selected.emergencyType} Emergency</h2>
                    <p className="mt-1 break-all text-sm text-gray-600">Report ID: {selected.id}</p>
                    <p className="text-sm text-gray-600">Reported: {new Date(selected.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Updated: {new Date(selected.updatedAt).toLocaleString()}</p>
                    {selected.reportedBy && <p className="text-sm text-gray-700">Reported by: {selected.reportedBy}</p>}
                    {selected.contact && <p className="text-sm text-gray-700">Contact: {selected.contact}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${statusColor(selected.status)}`}
                    >
                      {selected.status.replace("_", " ")}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityColor(selected.priority)}`}
                    >
                      {selected.priority.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
                    Reporter Location
                  </h3>
                  <MapView coords={selected.location.coords} address={selected.location.address} />
                  <div className="mt-3 space-y-1 rounded-xl bg-gray-50 p-3 text-sm text-gray-900 ring-1 ring-gray-200">
                    {selected.location.coords && (
                      <p>
                        <span className="font-medium">Coords:</span> {selected.location.coords.lat.toFixed(6)},{" "}
                        {selected.location.coords.lng.toFixed(6)}
                      </p>
                    )}
                    {selected.location.address && (
                      <p>
                        <span className="font-medium">Address:</span> {selected.location.address}
                      </p>
                    )}
                    {selected.location.description && (
                      <p>
                        <span className="font-medium">Manual Description:</span> {selected.location.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">Source: {selected.location.source}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Report Details</h3>
                    <button
                      onClick={() => setEditMode((v) => !v)}
                      className="text-sm font-medium text-violet-700 hover:text-violet-800"
                    >
                      {editMode ? "Cancel Edit" : "Edit Report"}
                    </button>
                  </div>
                  {!editMode ? (
                    <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-900 ring-1 ring-gray-200">
                      <p className="whitespace-pre-wrap">{selected.description || "No description provided"}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={3}
                        aria-label="Description"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={editAddr}
                          onChange={(e) => setEditAddr(e.target.value)}
                          placeholder="Address"
                          aria-label="Address"
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                        />
                        <input
                          value={editLocDesc}
                          onChange={(e) => setEditLocDesc(e.target.value)}
                          placeholder="Manual location description"
                          aria-label="Manual location description"
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdits}
                          disabled={updating}
                          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditMode(false)}
                          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Response Actions</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionBtn disabled={updating} onClick={() => void updateStatus(selected.id, "acknowledged")} color="bg-orange-600">
                      Acknowledge
                    </ActionBtn>
                    <ActionBtn disabled={updating} onClick={() => void updateStatus(selected.id, "in_progress")} color="bg-blue-600">
                      In Progress
                    </ActionBtn>
                    <ActionBtn disabled={updating} onClick={() => void updateStatus(selected.id, "resolved")} color="bg-green-600">
                      Resolve
                    </ActionBtn>
                    <ActionBtn disabled={updating} onClick={() => void updateStatus(selected.id, "false_alarm")} color="bg-gray-600">
                      False Alarm
                    </ActionBtn>
                    <button
                      onClick={deleteReport}
                      disabled={deleting}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete Report"}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Add Note</h3>
                  <div className="mt-2 flex gap-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Log response/update..."
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                    />
                    <button
                      onClick={addNote}
                      disabled={updating || !note.trim()}
                      className="self-start rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {selected.notes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Activity Log</h3>
                    <ul className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      {selected.notes.map((n, i) => (
                        <li
                          key={i}
                          className="border-b border-gray-200 pb-2 text-sm text-gray-900 last:border-0 last:pb-0"
                        >
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-96 items-center justify-center">
                <p className="text-base text-gray-600">Select a report to view location, update, or delete</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-4 shadow-sm ${color}`}>
      <p className="text-xs font-medium text-white/90">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50 ${color}`}
    >
      {children}
    </button>
  );
}