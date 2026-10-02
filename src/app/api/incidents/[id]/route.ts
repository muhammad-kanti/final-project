import { NextRequest, NextResponse } from "next/server";
import { getIncidentById, updateIncident, deleteIncident } from "@/lib/db";
import { nowIso } from "@/lib/time";
import type { UpdateIncidentInput, IncidentStatus } from "@/types/incident";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const incident = await getIncidentById(id);
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ incident });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as UpdateIncidentInput;
  const existing = await getIncidentById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: any = { updatedAt: nowIso() };
  if (body.status !== undefined) {
    updates.status = body.status as IncidentStatus;
    if (body.status === "acknowledged" && !existing.acknowledgedAt) updates.acknowledgedAt = nowIso();
    if ((body.status === "resolved" || body.status === "false_alarm") && !existing.resolvedAt) updates.resolvedAt = nowIso();
  }
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.location !== undefined) {
    updates.location = {
      coords: body.location.coords ?? existing.location.coords,
      address: body.location.address ?? existing.location.address,
      description: body.location.description ?? existing.location.description,
      source: body.location.source ?? existing.location.source,
    };
  }
  if (body.description !== undefined) updates.description = body.description;

  const updated = await updateIncident(id, updates);
  return NextResponse.json({ incident: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const ok = await deleteIncident(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
