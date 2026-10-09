import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { countUsers, createUser } from "@/lib/users";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/sessions";
import { toSafeUser } from "@/types/auth";

export const runtime = "nodejs";

interface SetupBody {
  email?: string;
  name?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  try {
    if ((await countUsers()) > 0) {
      return NextResponse.json({ error: "Setup has already been completed" }, { status: 409 });
    }

    const body = (await req.json()) as SetupBody;
    const email = (body.email ?? "").trim();
    const name = (body.name ?? "").trim();
    const password = body.password ?? "";

    if (!email || !name || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    let user;
    try {
      user = await createUser({ email, name, password, role: "admin" });
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
    const message = e instanceof Error ? e.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}