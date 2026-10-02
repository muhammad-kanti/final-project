import { NextRequest, NextResponse } from "next/server";
import { createIncident, getIncidents } from "@/lib/db";
import { generateId } from "@/lib/ids";
import { nowIso } from "@/lib/time";
import type { CreateIncidentInput, Incident } from "@/types/incident";

export const runtime = "nodejs";

export async function GET() {
  const incidents = await getIncidents();
  return NextResponse.json({ incidents });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateIncidentInput;
    if (!body.emergencyType || !body.location) {
      return NextResponse.json({ error: "emergencyType and location are required" }, { status: 400 });
    }

    const t = nowIso();
    const incident: Incident = {
      id: generateId(),
      emergencyType: body.emergencyType,
      description: body.description ?? null,
      location: {
        coords: body.location.coords ?? null,
        address: body.location.address ?? null,
        description: body.location.description ?? null,
        source: body.location.source,
      },
      reportedBy: body.reportedBy ?? null,
      contact: body.contact ?? null,
      status: "pending",
      priority: body.priority ?? "high",
      createdAt: t,
      updatedAt: t,
      acknowledgedAt: null,
      resolvedAt: null,
      assignedTo: null,
      notes: [],
    };

    await createIncident(incident);
    return NextResponse.json({ incident }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid request" }, { status: 400 });
  }
}
