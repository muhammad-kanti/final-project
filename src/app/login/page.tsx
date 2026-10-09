"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "signin" | "register";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setNeedsSetup(Boolean(d?.needsSetup)))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode === "signin" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong");
        return;
      }
      router.push(data?.user?.role === "admin" ? "/admin" : next);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F6FA] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">NSUK Campus Emergency Response</h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === "signin" ? "Sign in to track and manage your reports" : "Create an account to track your reports"}
          </p>
        </div>

        {needsSetup && (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            No admin account exists yet.{" "}
            <Link href="/setup" className="font-semibold underline">
              Run first-time setup
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          {mode === "register" && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-900">
                Full name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
            />
            {mode === "register" && (
              <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
          >
            {busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError(null);
            }}
            className="w-full text-sm font-medium text-violet-700 hover:text-violet-800"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already registered? Sign in"}
          </button>
        </form>

        <p className="text-center text-sm">
          <Link href="/" className="font-medium text-violet-700 hover:text-violet-800">
            Back to reporting
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}