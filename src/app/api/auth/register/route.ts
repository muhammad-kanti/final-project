import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createUser } from "@/lib/users";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/sessions";
import { toSafeUser } from "@/types/auth";

export const runtime = "nodejs";

interface RegisterBody {
  email?: string;
  name?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody;
    const email = (body.email ?? "").trim();
    const name = (body.name ?? "").trim();
    const password = body.password ?? "";

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    let user;
    try {
      user = await createUser({ email, name, password, role: "reporter" });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "EMAIL_TAKEN") {
        return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
      }
      throw e;
    }

    const session = await createSession(user.id);
    const store = await cookies();
    store.set(SESSION_COOKIE, session.token, sessionCookieOptions());

    return NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}