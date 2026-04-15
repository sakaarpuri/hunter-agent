"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, LockKey, UserCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth";

type Mode = "signup" | "signin" | "forgot";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
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

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setPassword("");
    setError(null);
    setForgotSent(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "signup") {
        await postJson<{ user: AuthUser }>("/api/auth/signup", { name, email, password });
        window.location.reload();
      } else if (mode === "signin") {
        await postJson<{ user: AuthUser }>("/api/auth/login", { email, password });
        window.location.reload();
      } else {
        await postJson<{ ok: boolean }>("/api/auth/forgot-password", { email });
        setForgotSent(true);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not continue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      {/* Back to home */}
      <div className="mx-auto max-w-[1400px] mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
        >
          <ArrowLeft size={14} weight="bold" />
          Back to home
        </Link>
      </div>

      <div className="mx-auto grid min-h-[calc(100dvh-6rem)] max-w-[1400px] items-center gap-10 lg:grid-cols-[1.04fr_0.96fr]">

        {/* Left — value prop */}
        <section className="max-w-[42rem]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-4 py-2 text-sm font-medium text-[var(--muted)] shadow-[0_18px_38px_-28px_rgba(20,43,40,0.24)] backdrop-blur-sm">
            <CheckCircle size={16} weight="duotone" className="text-[var(--accent)]" />
            Your jobs, your applications, your account
          </div>
          <h1 className="mt-8 text-5xl font-semibold tracking-[-0.06em] text-[var(--ink)] md:text-6xl md:leading-[0.94]">
            Everything stays with you.
          </h1>
          <p className="mt-6 max-w-[38rem] text-lg leading-8 text-[var(--muted)]">
            Your daily role preferences, generated CVs and cover letters, application history, and follow-up reminders — all tied to your account and available any time you sign in.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["Your history", "Every role matched, every CV generated — saved."],
              ["Your profile", "Set preferences once. Update any time from settings."],
              ["Any device", "Sign in from anywhere and pick up where you left off."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_24px_55px_-34px_rgba(20,43,40,0.18)]">
                <div className="rounded-[calc(1.8rem-0.375rem)] bg-white px-4 py-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                  <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Right — form */}
        <section className="rounded-[2.2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_40px_90px_-40px_rgba(20,43,40,0.35)]">
          <div className="rounded-[calc(2.2rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)] sm:p-8">

            {mode !== "forgot" && (
              <div className="flex rounded-full bg-[var(--surface)] p-1 text-sm font-medium text-[var(--muted)]">
                {([
                  ["signup", "Create account"],
                  ["signin", "Sign in"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchMode(value)}
                    className={cn(
                      "flex-1 rounded-full px-4 py-2.5 transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                      mode === value
                        ? "bg-white text-[var(--ink)] shadow-[0_14px_35px_-24px_rgba(20,43,40,0.4)]"
                        : "hover:text-[var(--ink)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {mode === "forgot" && (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
                  <LockKey size={18} weight="duotone" className="text-[var(--accent)]" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--ink)]">Reset your password</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">Enter your email and we&apos;ll send a reset link.</p>
                </div>
              </div>
            )}

            {mode === "forgot" && forgotSent ? (
              <div className="mt-8 space-y-4">
                <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] px-5 py-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-[var(--accent)]" />
                    <div>
                      <p className="font-medium text-[var(--ink)]">Check your inbox</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                        If that email has an account, a reset link is on its way. It expires in 1 hour.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  <ArrowLeft size={13} weight="bold" />
                  Back to sign in
                </button>
              </div>
            ) : (
              <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
                {mode === "signup" && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Your name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClass}
                      placeholder="Aisha Patel"
                      autoComplete="name"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                {mode !== "forgot" && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Password</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={inputClass}
                      placeholder="At least 6 characters and one number or symbol"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    />
                  </label>
                )}

                {mode !== "forgot" && (
                  <div className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                    <div className="flex items-start gap-3">
                      {mode === "signup"
                        ? <UserCircle size={18} weight="duotone" className="mt-0.5 shrink-0 text-[var(--accent)]" />
                        : <LockKey size={18} weight="duotone" className="mt-0.5 shrink-0 text-[var(--accent)]" />}
                      <div>
                        <p className="font-medium text-[var(--ink)]">
                          {mode === "signup" ? "What happens next" : "Signing back in"}
                        </p>
                        <p className="mt-0.5 leading-6">
                          {mode === "signup"
                            ? "We'll create your account and open your dashboard immediately. Your preferences, generated materials, and application history will be saved from this point on."
                            : "Use the email and password you signed up with. Your roles, CVs, cover letters, and application history will all be there."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                  {isSubmitting
                    ? "Working…"
                    : mode === "signup"
                      ? "Create your account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Sign in"}
                </button>

                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="w-full text-center text-sm text-[var(--muted)] transition-colors duration-200 hover:text-[var(--ink)]"
                  >
                    Forgot your password?
                  </button>
                )}

                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors duration-200 hover:text-[var(--ink)]"
                  >
                    <ArrowLeft size={13} weight="bold" />
                    Back to sign in
                  </button>
                )}
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
