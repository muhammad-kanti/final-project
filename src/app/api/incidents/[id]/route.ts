import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, forbidden, unauthorized } from "@/lib/auth/dal";
import { canTriage, canView, deleteVisibleIncident, isOwner } from "@/lib/incidents-dal";
import { getIncidentById, updateIncident } from "@/lib/db";
import { nowIso } from "@/lib/time";
import type { Incident, IncidentStatus, UpdateIncidentInput } from "@/types/incident";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

const STATUSES: IncidentStatus[] = ["pending", "acknowledged", "in_progress", "resolved", "false_alarm"];
const PRIORITIES: Incident["priority"][] = ["low", "medium", "high", "critical"];
const LOCATION_SOURCES: Incident["location"]["source"][] = ["device_gps", "geocode", "manual"];

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const incident = await getIncidentById(id);
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canView(user, incident)) return forbidden();

  return NextResponse.json({ incident });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const existing = await getIncidentById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as UpdateIncidentInput;
  const updates: Partial<Incident> = { updatedAt: nowIso() };
  const admin = canTriage(user);

  if (body.status !== undefined) {
    if (!admin) return forbidden("Only responders can change report status");
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "acknowledged" && !existing.acknowledgedAt) updates.acknowledgedAt = nowIso();
    if ((body.status === "resolved" || body.status === "false_alarm") && !existing.resolvedAt) {
      updates.resolvedAt = nowIso();
    }
  }

  if (body.priority !== undefined) {
    if (!admin) return forbidden("Only responders can change priority");
    if (!PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updates.priority = body.priority;
  }

  if (body.assignedTo !== undefined) {
    if (!admin) return forbidden("Only responders can assign reports");
    updates.assignedTo = body.assignedTo;
  }

  if (body.notes !== undefined) {
    if (!admin) return forbidden("Only responders can add notes");
    updates.notes = body.notes;
  }

  // A reporter may correct the details of their own report; responders may too.
  if (isOwner(user, existing) || admin) {
    if (body.description !== undefined) updates.description = body.description;
    if (body.contact !== undefined) updates.contact = body.contact;
    if (body.location !== undefined) {
      updates.location = {
        coords: body.location.coords ?? existing.location.coords,
        address: body.location.address ?? existing.location.address,
        description: body.location.description ?? existing.location.description,
        source: LOCATION_SOURCES.includes(body.location.source as never)
          ? (body.location.source as Incident["location"]["source"])
          : existing.location.source,
      };
    }
  } else {
    return forbidden();
  }

  const updated = await updateIncident(id, updates);
  return NextResponse.json({ incident: updated });
}

/** Admins may remove any report; a reporter may remove one they filed. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const result = await deleteVisibleIncident(user, id);

  if (result === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result === "forbidden") return forbidden();
  return NextResponse.json({ ok: true });
}