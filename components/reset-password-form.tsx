"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, LockKey, Warning } from "@phosphor-icons/react";

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? "Request failed");
  }
  return payload as T;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-[2rem] border border-[var(--border-soft)] bg-white p-8 shadow-[0_30px_70px_-36px_rgba(20,43,40,0.3)] text-center">
          <Warning size={36} weight="duotone" className="mx-auto text-rose-500" />
          <h1 className="mt-4 text-xl font-semibold text-[var(--ink)]">Invalid reset link</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            This link is missing a reset token. Request a new one from the sign-in page.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-[2rem] border border-[var(--border-soft)] bg-white p-8 shadow-[0_30px_70px_-36px_rgba(20,43,40,0.3)] text-center">
          <CheckCircle size={36} weight="duotone" className="mx-auto text-[var(--accent)]" />
          <h1 className="mt-4 text-xl font-semibold text-[var(--ink)]">Password updated</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Your password has been changed. Sign in with your new password.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await postJson<{ ok: boolean }>("/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-[2rem] border border-[var(--border-soft)] bg-white p-8 shadow-[0_30px_70px_-36px_rgba(20,43,40,0.3)]">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-[0_16px_36px_-22px_rgba(18,108,100,0.9)]">
          <LockKey size={18} weight="bold" className="text-white" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">Set a new password</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
          At least 6 characters with one number or symbol.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--ink)]">New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              placeholder="At least 6 characters and one number or symbol"
              autoComplete="new-password"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              placeholder="Same password again"
              autoComplete="new-password"
              required
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_-26px_rgba(18,108,100,0.9)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Updating…" : "Set new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
