import "server-only";

import { randomBytes } from "crypto";
import type { Session } from "@/types/auth";
import { readJson, updateJson } from "@/lib/store";

export const SESSION_COOKIE = "sos_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const FILE = "sessions.json";

interface SessionStore {
  sessions: Session[];
}

const EMPTY: SessionStore = { sessions: [] };

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<Session> {
  const token = generateSessionToken();
  const created = new Date();
  const session: Session = {
    token,
    userId,
    createdAt: created.toISOString(),
    expiresAt: new Date(created.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };
  await updateJson<SessionStore>(FILE, EMPTY, (store) => {
    store.sessions = store.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
    store.sessions.push(session);
  });
  return session;
}

export async function findValidSession(token: string): Promise<Session | null> {
  if (!token) return null;
  const store = await readJson<SessionStore>(FILE, EMPTY);
  const session = store.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteSession(token);
    return null;
  }
  return session;
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await updateJson<SessionStore>(FILE, EMPTY, (store) => {
    store.sessions = store.sessions.filter((s) => s.token !== token);
  });
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await updateJson<SessionStore>(FILE, EMPTY, (store) => {
    store.sessions = store.sessions.filter((s) => s.userId !== userId);
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}