import { NextRequest, NextResponse } from "next/server";
import { getIncidentById, updateIncident } from "@/lib/db";
import { nowIso } from "@/lib/time";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const existing = await getIncidentById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: any = { updatedAt: nowIso() };
  if (body.description !== undefined) updates.description = body.description;
  if (body.location !== undefined) {
    updates.location = {
      coords: body.location.coords ?? existing.location.coords,
      address: body.location.address ?? existing.location.address,
      description: body.location.description ?? existing.location.description,
      source: body.location.source ?? existing.location.source,
    };
  }
  if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.notes !== undefined) updates.notes = body.notes;

  const updated = await updateIncident(id, updates);
  return NextResponse.json({ incident: updated });
}
