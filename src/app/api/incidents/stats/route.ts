import { NextResponse } from "next/server";
import { getIncidents } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const incidents = await getIncidents();
  const pending = incidents.filter((i) => i.status === "pending").length;
  const active = incidents.filter((i) => i.status === "acknowledged" || i.status === "in_progress").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const falseAlarm = incidents.filter((i) => i.status === "false_alarm").length;
  const critical = incidents.filter((i) => i.priority === "critical").length;
  return NextResponse.json({ counts: { pending, active, resolved, falseAlarm, critical, total: incidents.length } });
}
