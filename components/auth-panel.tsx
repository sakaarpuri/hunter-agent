"use client";

import { useState } from "react";
import { CheckCircle, LockKey, UserCircle } from "@phosphor-icons/react";
import type { AuthUser } from "@/lib/auth";

type Mode = "signup" | "signin";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setPassword("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "signup") {
        await postJson<{ user: AuthUser }>("/api/auth/signup", { name, email, password });
      } else {
        await postJson<{ user: AuthUser }>("/api/auth/login", { email, password });
      }
      window.location.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not continue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-[1400px] items-center gap-10 lg:grid-cols-[1.04fr_0.96fr]">
        <section className="max-w-[42rem]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-4 py-2 text-sm font-medium text-[var(--muted)] shadow-[0_18px_38px_-28px_rgba(20,43,40,0.24)] backdrop-blur-sm">
            <CheckCircle size={16} weight="duotone" className="text-[var(--accent)]" />
            Email-first job scouting with a real account behind it now
          </div>
          <h1 className="mt-8 text-5xl font-semibold tracking-[-0.06em] text-[var(--ink)] md:text-6xl md:leading-[0.94]">
            Sign in to keep your briefs, packs, and follow-ups tied to you.
          </h1>
          <p className="mt-6 max-w-[38rem] text-lg leading-8 text-[var(--muted)]">
            HunterAgent now saves your workspace per account, so your daily brief settings, application packs, prompt history,
            and applied timeline stay with you across refreshes and future devices.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ["Real accounts", "Email and password with secure sessions instead of one shared local workspace."],
              ["Your identity", "The dashboard shows your chosen name and gives you clean profile settings."],
              ["Durable memory", "Brief history, prompt refinements, and applied records now persist per user."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-white px-5 py-5 shadow-[0_24px_55px_-34px_rgba(20,43,40,0.22)]">
                <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--border-soft)] bg-white p-6 shadow-[0_30px_70px_-36px_rgba(20,43,40,0.3)] sm:p-8">
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
                  "flex-1 rounded-full px-4 py-2.5 transition-colors",
                  mode === value ? "bg-white text-[var(--ink)] shadow-[0_14px_35px_-24px_rgba(20,43,40,0.4)]" : "hover:text-[var(--ink)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Your name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                  placeholder="Aisha Patel"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                placeholder="At least 6 characters and one number or symbol"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </label>

            <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
              <div className="flex items-start gap-3">
                {mode === "signup" ? <UserCircle size={18} className="mt-1 text-[var(--accent)]" /> : <LockKey size={18} className="mt-1 text-[var(--accent)]" />}
                <div>
                  <p className="font-medium text-[var(--ink)]">{mode === "signup" ? "What happens next" : "Sign-in baseline"}</p>
                  <p>
                    {mode === "signup"
                      ? "We’ll create your HunterAgent account, open your saved workspace immediately, and keep that workspace tied to your email from then on."
                      : "Use the same email and password you created here. Your prompts, packs, and applied history will load into the dashboard after sign in."}
                  </p>
                </div>
              </div>
            </div>

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
              {isSubmitting ? "Working…" : mode === "signup" ? "Create HunterAgent account" : "Sign in to HunterAgent"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
