import { NextRequest, NextResponse } from "next/server";
import { createIncident, getIncidents } from "@/lib/db";
import { getCurrentUser, forbidden, unauthorized } from "@/lib/auth/dal";
import { generateId } from "@/lib/ids";
import { nowIso } from "@/lib/time";
import type { CreateIncidentInput, EmergencyType, Incident, LocationSource } from "@/types/incident";

export const runtime = "nodejs";

const EMERGENCY_TYPES: EmergencyType[] = ["medical", "fire", "accident", "theft", "assault", "other"];
const LOCATION_SOURCES: LocationSource[] = ["device_gps", "geocode", "manual"];
const PRIORITIES: Incident["priority"][] = ["low", "medium", "high", "critical"];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Admin-only. Reporters must use /api/incidents/mine so that emergency reports
 * belonging to other students are not exposed.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("Admin access required");

  const incidents = await getIncidents();
  return NextResponse.json({ incidents });
}

/**
 * Submitting a report intentionally does not require an account so that nobody
 * is blocked from raising an alarm. When the reporter happens to be signed in,
 * the report is stamped with their id so they can track and delete it later.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = (await req.json()) as Partial<CreateIncidentInput>;

    if (!body.emergencyType || !EMERGENCY_TYPES.includes(body.emergencyType)) {
      return NextResponse.json({ error: "A valid emergencyType is required" }, { status: 400 });
    }
    if (!body.location) {
      return NextResponse.json({ error: "A location is required" }, { status: 400 });
    }

    const rawCoords = body.location.coords;
    let coords = null;
    if (rawCoords && isFiniteNumber(rawCoords.lat) && isFiniteNumber(rawCoords.lng)) {
      if (rawCoords.lat < -90 || rawCoords.lat > 90 || rawCoords.lng < -180 || rawCoords.lng > 180) {
        return NextResponse.json({ error: "Coordinates are out of range" }, { status: 400 });
      }
      coords = {
        lat: rawCoords.lat,
        lng: rawCoords.lng,
        accuracy: isFiniteNumber(rawCoords.accuracy) ? rawCoords.accuracy : null,
      };
    }

    const source = LOCATION_SOURCES.includes(body.location.source) ? body.location.source : "manual";
    if (!coords && source !== "manual" && !body.location.description) {
      return NextResponse.json(
        { error: "Provide coordinates or a written location description" },
        { status: 400 }
      );
    }

    const t = nowIso();
    const incident: Incident = {
      id: generateId(),
      emergencyType: body.emergencyType,
      description: body.description?.trim() || null,
      location: {
        coords,
        address: body.location.address?.trim() || null,
        description: body.location.description?.trim() || null,
        source,
      },
      ownerId: user?.id ?? null,
      reportedBy: body.reportedBy?.trim() || user?.name || null,
      contact: body.contact?.trim() || null,
      status: "pending",
      priority: body.priority && PRIORITIES.includes(body.priority) ? body.priority : "high",
      createdAt: t,
      updatedAt: t,
      acknowledgedAt: null,
      resolvedAt: null,
      assignedTo: null,
      notes: [],
    };

    await createIncident(incident);
    return NextResponse.json({ incident }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}