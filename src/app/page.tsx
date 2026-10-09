"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateIncidentInput, EmergencyType, GeoCoords, Incident, IncidentLocation } from "@/types/incident";
import type { SafeUser } from "@/types/auth";
import { SosButton } from "@/components/sos-button";
import { MapPicker } from "@/components/leaflet-map";
import { useOnline } from "@/hooks/use-online";
import { dropQueuedReport, enqueue, syncOutbox } from "@/lib/sync";
import { idbGetIncidents, idbSaveIncident } from "@/lib/idb";
import Link from "next/link";

const EMERGENCIES: { value: EmergencyType; label: string; icon: string }[] = [
  { value: "medical", label: "Medical", icon: "🏥" },
  { value: "fire", label: "Fire", icon: "🔥" },
  { value: "accident", label: "Accident", icon: "🚑" },
  { value: "theft", label: "Theft", icon: "🚨" },
  { value: "assault", label: "Assault", icon: "🛡️" },
  { value: "other", label: "Other", icon: "⚠️" },
];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Home() {
  const [type, setType] = useState<EmergencyType>("medical");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [manualDesc, setManualDesc] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastIncident, setLastIncident] = useState<Incident | null>(null);

  const [user, setUser] = useState<SafeUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [myReports, setMyReports] = useState<Incident[]>([]);
  const [queued, setQueued] = useState<Incident[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const online = useOnline();

  const loadQueued = useCallback(async () => {
    try {
      const list = (await idbGetIncidents()) as Incident[];
      setQueued(list);
    } catch {
      setQueued([]);
    }
  }, []);

  const loadMyReports = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents/mine", { cache: "no-store" });
      if (res.status === 401) {
        setMyReports([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to load your reports");
      const data = await res.json();
      setMyReports(data.incidents ?? []);
      setReportError(null);
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "Failed to load your reports");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [me, queuedList] = await Promise.all([
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        idbGetIncidents().catch(() => [] as unknown[]),
      ]);
      if (!active) return;
      setUser(me?.user ?? null);
      setAuthChecked(true);
      setQueued(queuedList as Incident[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      await loadMyReports();
    })();
  }, [user, loadMyReports]);

  useEffect(() => {
    if (!online) return;
    let active = true;
    void (async () => {
      await syncOutbox();
      const list = await idbGetIncidents().catch(() => [] as unknown[]);
      if (!active) return;
      setQueued(list as Incident[]);
      if (user) await loadMyReports();
    })();
    return () => {
      active = false;
    };
  }, [online, user, loadMyReports]);

  function buildLocation(): IncidentLocation {
    return {
      coords: coords ? { lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy ?? null } : null,
      address,
      description: manualDesc.trim() ? manualDesc.trim() : null,
      source: coords ? (address ? "geocode" : "device_gps") : "manual",
    };
  }

  async function submitIncident() {
    setSubmitting(true);
    setStatusMsg(null);
    setReportError(null);

    const payload: CreateIncidentInput = {
      emergencyType: type,
      description: description.trim() || null,
      location: buildLocation(),
      priority: "critical",
    };

    try {
      if (online) {
        const res = await fetch("/api/incidents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Failed to send alert (${res.status})`);

        const incident: Incident = data.incident;
        setLastIncident(incident);
        setStatusMsg("Emergency alert sent successfully. Help is on the way.");
        if (user) void loadMyReports();
      } else {
        const tempId = newId();
        await enqueue(payload, tempId);
        await idbSaveIncident({
          id: tempId,
          emergencyType: payload.emergencyType,
          description: payload.description ?? null,
          location: payload.location,
          ownerId: user?.id ?? null,
          reportedBy: user?.name ?? null,
          contact: null,
          status: "pending",
          priority: "critical",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          acknowledgedAt: null,
          resolvedAt: null,
          assignedTo: null,
          notes: [],
        });
        await loadQueued();
        setStatusMsg("You are offline. Alert queued and will auto-sync when back online.");
      }

      setDescription("");
      setManualDesc("");
    } catch (e: unknown) {
      setStatusMsg(e instanceof Error ? e.message : "Failed to send alert");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReport(incident: Incident) {
    if (!confirm("Delete this report? This removes it for you and for responders.")) return;
    setDeletingId(incident.id);
    setReportError(null);
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to delete report");
      }
      await loadMyReports();
    } catch (e: unknown) {
      setReportError(e instanceof Error ? e.message : "Failed to delete report");
    } finally {
      setDeletingId(null);
    }
  }

  async function discardQueued(id: string) {
    if (!confirm("Withdraw this queued report? It will not be sent.")) return;
    await dropQueuedReport(id);
    await loadQueued();
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMyReports([]);
  }

  const allReports = [...myReports, ...queued];

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 sm:text-lg">NSUK Campus Emergency Response</h1>
              <p className="text-xs text-gray-500">Stay safe. Get help faster.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#my-reports"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              My Reports
            </a>
            {authChecked && user ? (
              <>
                <span className="hidden text-sm text-gray-600 sm:inline">{user.name}</span>
                <button
                  onClick={signOut}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:from-violet-700 hover:to-indigo-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="space-y-5 text-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Emergency SOS</h2>
                  <p className="mt-1 text-sm text-gray-500">Tap below to send an instant alert</p>
                </div>
                <SosButton onClick={submitIncident} disabled={submitting} />
                {statusMsg && (
                  <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-medium text-gray-900 ring-1 ring-violet-100">
                    {statusMsg}
                  </div>
                )}
                {lastIncident && (
                  <div className="rounded-2xl bg-gray-50 px-4 py-3 text-left text-sm text-gray-900 ring-1 ring-gray-200">
                    <p>
                      Report ID: <span className="font-semibold">{lastIncident.id.slice(0, 8)}</span>
                    </p>
                    <p>
                      Status:{" "}
                      <span className="font-semibold capitalize">{lastIncident.status.replace("_", " ")}</span>
                    </p>
                    {!lastIncident.ownerId && (
                      <p className="mt-2 text-xs text-gray-500">
                        Sign in to track and delete this report.
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  {online ? "Connected • Real-time alerts enabled" : "Offline • Alerts queued for auto-sync"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Select Emergency Type</h3>
              <p className="mt-1 text-xs text-gray-500">Choose the situation to help responders prioritize</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {EMERGENCIES.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setType(e.value)}
                    aria-pressed={type === e.value}
                    className={`group flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-sm font-medium shadow-sm transition hover:bg-gray-50 ${
                      type === e.value
                        ? "border-violet-600 bg-violet-50 text-gray-900 ring-2 ring-violet-500/20"
                        : "border-gray-200 bg-white text-gray-800"
                    }`}
                  >
                    <span className="text-xl">{e.icon}</span>
                    <span>{e.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <label htmlFor="description" className="text-sm font-semibold text-gray-900">
                Additional Details
              </label>
              <p className="mt-1 text-xs text-gray-500">Optional — add key info for responders</p>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. Number of people, visible hazards..."
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
              />
              <button
                onClick={submitIncident}
                disabled={submitting}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Sending Alert..." : "Send Emergency Alert"}
              </button>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Location Information</h3>
                <p className="mt-1 text-xs text-gray-500">Pin your location or provide a manual description for accuracy</p>
              </div>
              <MapPicker
                center={coords}
                onLocationChange={(c, addr) => {
                  setCoords(c);
                  setAddress(addr ?? null);
                }}
                onManualDescription={(d) => setManualDesc(d ?? "")}
              />
              {(coords || manualDesc) && (
                <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-900 ring-1 ring-gray-200">
                  {coords && (
                    <div>
                      <span className="font-medium">Coordinates:</span> {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                    </div>
                  )}
                  {address && (
                    <div className="mt-1">
                      <span className="font-medium">Address:</span> {address}
                    </div>
                  )}
                  {manualDesc && (
                    <div className="mt-1">
                      <span className="font-medium">Location Note:</span> {manualDesc}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div id="my-reports" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">My Reports</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Track your submitted incidents and withdraw them if needed
                  </p>
                </div>
                {user && (
                  <button
                    onClick={() => {
                      void loadMyReports();
                      void loadQueued();
                    }}
                    className="text-sm font-medium text-violet-700 hover:text-violet-800"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {authChecked && !user && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-600">
                  <p>
                    <Link href="/login" className="font-semibold text-violet-700 hover:text-violet-800">
                      Sign in
                    </Link>{" "}
                    to see, track and delete your reports.
                  </p>
                  <p className="mt-2 text-xs">
                    You can still send an emergency alert without an account.
                  </p>
                </div>
              )}

              {reportError && (
                <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
                  {reportError}
                </div>
              )}

              <div className="space-y-3">
                {user && allReports.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-500">
                    No reports yet. Submit an emergency alert to see it here.
                  </div>
                )}

                {allReports.map((i) => (
                  <div key={i.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold capitalize text-gray-900">
                          {i.emergencyType} Emergency
                        </p>
                        <p className="text-xs text-gray-500">{new Date(i.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold capitalize text-violet-800 ring-1 ring-violet-200">
                        {i.status.replace("_", " ")}
                      </span>
                    </div>
                    {i.description && <p className="mt-3 text-sm text-gray-900">{i.description}</p>}
                    {i.location?.address && <p className="mt-2 text-xs text-gray-600">{i.location.address}</p>}
                    {i.location?.description && <p className="mt-1 text-xs text-gray-600">{i.location.description}</p>}
                    {i.acknowledgedAt && (
                      <p className="mt-3 text-xs text-gray-500">
                        Acknowledged: {new Date(i.acknowledgedAt).toLocaleString()}
                      </p>
                    )}
                    {i.resolvedAt && (
                      <p className="mt-1 text-xs text-gray-500">Resolved: {new Date(i.resolvedAt).toLocaleString()}</p>
                    )}
                    {i.notes && i.notes.length > 0 && (
                      <div className="mt-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Responder Updates
                        </p>
                        <ul className="mt-2 space-y-1">
                          {i.notes.map((n, idx) => (
                            <li key={idx} className="text-xs text-gray-700">
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      {queued.some((q) => q.id === i.id) ? (
                        <button
                          onClick={() => void discardQueued(i.id)}
                          disabled={deletingId === i.id}
                          className="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Withdraw queued report
                        </button>
                      ) : (
                        <button
                          onClick={() => void deleteReport(i)}
                          disabled={deletingId === i.id}
                          className="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === i.id ? "Deleting..." : "Delete report"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}