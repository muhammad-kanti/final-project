import { NextResponse } from "next/server";
import { countUsers } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const needsSetup = (await countUsers()) === 0;
  return NextResponse.json({ needsSetup });
}