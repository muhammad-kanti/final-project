import { NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/auth/dal";
import { listOwnedIncidents } from "@/lib/incidents-dal";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const incidents = await listOwnedIncidents(user.id);
  return NextResponse.json({ incidents });
}