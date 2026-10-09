"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SetupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        if (d?.needsSetup === false) setAlreadyDone(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Setup failed");
        return;
      }
      router.push("/admin");
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
          <h1 className="text-xl font-semibold text-gray-900">First-time setup</h1>
          <p className="mt-1 text-sm text-gray-500">Create the responder account that manages emergency reports.</p>
        </div>

        {checking && <p className="text-center text-sm text-gray-500">Checking setup status...</p>}

        {alreadyDone && (
          <div className="space-y-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-700">An administrator already exists. Setup is closed.</p>
            <Link href="/login" className="inline-block font-medium text-violet-700 hover:text-violet-800">
              Go to sign in
            </Link>
          </div>
        )}

        {!checking && !alreadyDone && (
          <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div>
              <label htmlFor="setup-name" className="block text-sm font-medium text-gray-900">
                Full name
              </label>
              <input
                id="setup-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
              />
            </div>
            <div>
              <label htmlFor="setup-email" className="block text-sm font-medium text-gray-900">
                Email
              </label>
              <input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
              />
            </div>
            <div>
              <label htmlFor="setup-password" className="block text-sm font-medium text-gray-900">
                Password
              </label>
              <input
                id="setup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
            </div>
            <div>
              <label htmlFor="setup-confirm" className="block text-sm font-medium text-gray-900">
                Confirm password
              </label>
              <input
                id="setup-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-black shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/10"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
            >
              {busy ? "Creating account..." : "Create admin account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}