import "server-only";

import type { SafeUser } from "@/types/auth";
import type { Incident } from "@/types/incident";
import { deleteIncident, getIncidentById, getIncidents } from "@/lib/db";

export function isAdmin(user: SafeUser | null): boolean {
  return user?.role === "admin";
}

export function isOwner(user: SafeUser | null, incident: Incident): boolean {
  return !!user && !!incident.ownerId && incident.ownerId === user.id;
}

/** Admins see every report. Reporters only see the reports they filed. */
export function canView(user: SafeUser, incident: Incident): boolean {
  return isAdmin(user) || isOwner(user, incident);
}

/** Admins may remove any report; a reporter may remove their own. */
export function canDelete(user: SafeUser, incident: Incident): boolean {
  return isAdmin(user) || isOwner(user, incident);
}

/** Admins may fully triage any report. */
export function canTriage(user: SafeUser): boolean {
  return isAdmin(user);
}

export async function listVisibleIncidents(user: SafeUser): Promise<Incident[]> {
  const all = await getIncidents();
  if (isAdmin(user)) return all;
  return all.filter((i) => isOwner(user, i));
}

export async function listOwnedIncidents(userId: string): Promise<Incident[]> {
  const all = await getIncidents();
  return all.filter((i) => i.ownerId === userId);
}

export async function findVisibleIncident(
  user: SafeUser,
  id: string
): Promise<{ incident: Incident | null; visible: boolean }> {
  const incident = await getIncidentById(id);
  if (!incident) return { incident: null, visible: false };
  return { incident, visible: canView(user, incident) };
}

export async function deleteVisibleIncident(user: SafeUser, id: string): Promise<"deleted" | "not_found" | "forbidden"> {
  const incident = await getIncidentById(id);
  if (!incident) return "not_found";
  if (!canDelete(user, incident)) return "forbidden";
  const ok = await deleteIncident(id);
  return ok ? "deleted" : "not_found";
}