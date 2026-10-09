import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SafeUser } from "@/types/auth";
import { toSafeUser } from "@/types/auth";
import { SESSION_COOKIE, deleteSession, findValidSession } from "@/lib/sessions";
import { getUserById } from "@/lib/users";

/**
 * Cached per request so repeated lookups within one render or handler share a
 * single read of the session store.
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await findValidSession(token);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) {
    await deleteSession(token);
    return null;
  }
  return toSafeUser(user);
});

export function unauthorized(message = "Sign in to continue"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "You do not have access to this resource"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}