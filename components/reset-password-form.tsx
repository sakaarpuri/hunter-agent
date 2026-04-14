"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, LockKey, Warning } from "@phosphor-icons/react";

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

const inputClass =
  "w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3.5 text-sm text-[var(--ink)] outline-none transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] focus:border-[var(--accent)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(18,108,100,0.1)] placeholder:text-[var(--muted)]/60";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to sign in
          </Link>
        </div>
        <div className="w-full max-w-sm">
          <div className="rounded-[2.2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_40px_90px_-40px_rgba(20,43,40,0.35)]">
            <div className="rounded-[calc(2.2rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] sm:p-8 text-center">
              <Warning size={36} weight="duotone" className="mx-auto text-rose-500" />
              <h1 className="mt-4 text-xl font-semibold text-[var(--ink)]">Invalid reset link</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                This reset link isn&apos;t valid. Request a new one to continue.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to sign in
          </Link>
        </div>
        <div className="w-full max-w-sm">
          <div className="rounded-[2.2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_40px_90px_-40px_rgba(20,43,40,0.35)]">
            <div className="rounded-[calc(2.2rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] sm:p-8 text-center">
              <CheckCircle size={36} weight="duotone" className="mx-auto text-[var(--accent)]" />
              <h1 className="mt-4 text-xl font-semibold text-[var(--ink)]">Password updated</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Password updated. You&apos;re ready to sign in.
              </p>
              <Link
                href="/dashboard"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
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
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
        >
          <ArrowLeft size={14} weight="bold" />
          Back to sign in
        </Link>
      </div>
      <div className="w-full max-w-sm">
        <div className="rounded-[2.2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_40px_90px_-40px_rgba(20,43,40,0.35)]">
          <div className="rounded-[calc(2.2rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-[0_16px_36px_-22px_rgba(18,108,100,0.9)]">
              <LockKey size={18} weight="bold" className="text-white" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">Set a new password</h1>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Choose a strong password — at least 6 characters with a number or symbol.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--ink)]">New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
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
                  className={inputClass}
                  placeholder="••••••••"
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
                className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_-26px_rgba(18,108,100,0.9)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
              >
                {isSubmitting ? "Updating…" : "Set new password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
