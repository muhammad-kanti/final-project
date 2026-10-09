import "server-only";

import type { Role, User } from "@/types/auth";
import { generateId } from "@/lib/ids";
import { nowIso } from "@/lib/time";
import { hashPassword } from "@/lib/auth/password";
import { readJson, updateJson } from "@/lib/store";

const FILE = "users.json";

interface UserStore {
  users: User[];
}

const EMPTY: UserStore = { users: [] };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function countUsers(): Promise<number> {
  const store = await readJson<UserStore>(FILE, EMPTY);
  return store.users.length;
}

export async function getUserById(id: string): Promise<User | null> {
  const store = await readJson<UserStore>(FILE, EMPTY);
  return store.users.find((u) => u.id === id) ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const store = await readJson<UserStore>(FILE, EMPTY);
  const target = normalizeEmail(email);
  return store.users.find((u) => u.email === target) ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const user: User = {
    id: generateId(),
    email,
    name: input.name.trim(),
    passwordHash,
    role: input.role,
    createdAt: nowIso(),
  };

  await updateJson<UserStore>(FILE, EMPTY, (store) => {
    if (store.users.some((u) => u.email === email)) {
      throw new Error("EMAIL_TAKEN");
    }
    store.users.push(user);
  });

  return user;
}

export async function listUsers(): Promise<User[]> {
  const store = await readJson<UserStore>(FILE, EMPTY);
  return store.users;
}