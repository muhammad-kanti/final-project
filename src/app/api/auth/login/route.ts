import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByEmail, normalizeEmail } from "@/lib/users";
import { verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/sessions";
import { toSafeUser } from "@/types/auth";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LoginBody;
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await findUserByEmail(normalizeEmail(email));
    // Always run a verification so a missing account and a wrong password take
    // comparable time, which avoids leaking which emails are registered.
    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

    if (!user || !ok) {
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
    }

    const session = await createSession(user.id);
    const store = await cookies();
    store.set(SESSION_COOKIE, session.token, sessionCookieOptions());

    return NextResponse.json({ user: toSafeUser(user) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Sign in failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}