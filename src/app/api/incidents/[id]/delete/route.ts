import { NextRequest, NextResponse } from "next/server";
import { deleteIncident, getIncidentById } from "@/lib/db";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await getIncidentById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ok = await deleteIncident(id);
  return NextResponse.json({ ok });
}
