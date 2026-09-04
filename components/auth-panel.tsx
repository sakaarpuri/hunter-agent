"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Eye,
  EyeSlash,
  FileText,
  LockKey,
  EnvelopeSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth";
import { Brand } from "./brand";
import styles from "./account-flow.module.css";

type Mode = "signup" | "signin" | "forgot";

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error ??
        "We couldn't complete that request. Please try again.",
    );
  }
  return payload as T;
}

const modeCopy = {
  signup: {
    eyebrow: "MAKE YOUR NEXT MOVE",
    title: "Good work starts here.",
    description:
      "Keep your options open. Tell us what would make an opportunity worth considering, even if you're happy where you are.",
    action: "Create your account",
    pending: "Creating your account...",
  },
  signin: {
    eyebrow: "BACK TO YOUR SEARCH",
    title: "Welcome back.",
    description:
      "Your roles, application materials, and next steps are right where you left them.",
    action: "Sign in",
    pending: "Signing you in...",
  },
  forgot: {
    eyebrow: "LET'S GET YOU BACK IN",
    title: "A fresh start.",
    description:
      "Enter your account email and we'll send you a link to reset your password.",
    action: "Send reset link",
    pending: "Requesting your reset link...",
  },
} as const;

export function AuthPanel({
  initialMode = "signup",
}: {
  initialMode?: "signup" | "signin";
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const copy = modeCopy[mode];

  function switchMode(nextMode: Mode) {
    if (isSubmitting || nextMode === mode) return;
    setMode(nextMode);
    setPassword("");
    setPasswordVisible(false);
    setError(null);
    setForgotSent(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "signup") {
        await postJson<{ user: AuthUser }>("/api/auth/signup", {
          name,
          email,
          password,
        });
        window.location.reload();
      } else if (mode === "signin") {
        await postJson<{ user: AuthUser }>("/api/auth/login", {
          email,
          password,
        });
        window.location.reload();
      } else {
        await postJson<{ ok: boolean }>("/api/auth/forgot-password", { email });
        setForgotSent(true);
      }
    } catch (submitError) {
      setError(
        submitError instanceof TypeError
          ? "We couldn't connect. Check your connection and try again. Your entries are still here."
          : submitError instanceof Error
            ? submitError.message
            : "We couldn't continue. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <div className={styles.authLayout}>
        <section
          className={styles.authStory}
          aria-labelledby="auth-story-heading"
        >
          <Brand />

          <div className={styles.storyBody}>
            <p className={styles.storyEyebrow}>
              <span aria-hidden="true" /> YOUR NEXT CHAPTER
            </p>
            <h1 id="auth-story-heading">
              Keep your job.
              <br />
              Find your <span>what if.</span>
            </h1>
            <p className={styles.storyDescription}>
              A good career can still have an extraordinary next chapter. A few
              possibilities in your inbox, with no pressure to act.
            </p>
            <div className={styles.storyFeatures}>
              {[
                {
                  icon: EnvelopeSimple,
                  title: "A brief built around you",
                  body: "Roles matched to your preferences, delivered to your inbox.",
                },
                {
                  icon: FileText,
                  title: "Your experience, well told",
                  body: "Tailored CVs and cover letters for the roles you choose.",
                },
                {
                  icon: ArrowUpRight,
                  title: "Every next step, in one place",
                  body: "Keep your applications and follow-ups together.",
                },
              ].map(({ icon: Icon, title, body }, index) => (
                <div className={styles.storyFeature} key={title}>
                  <span className={styles.featureIcon}>
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>{title}</h2>
                    <p>{body}</p>
                  </div>
                  <span className={styles.featureNumber} aria-hidden="true">
                    0{index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p className={styles.storyFooter}>
            <span aria-hidden="true" /> Your career. Your direction.
          </p>
        </section>

        <section
          className={styles.authFormSide}
          aria-labelledby="auth-form-heading"
        >
          <Link href="/" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to home
          </Link>
          <div className={styles.authFormInner}>
            {mode !== "forgot" && (
              <div
                className={styles.modeSwitch}
                role="group"
                aria-label="Account access"
              >
                {(
                  [
                    ["signup", "Create account"],
                    ["signin", "Sign in"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchMode(value)}
                    aria-pressed={mode === value}
                    disabled={isSubmitting}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <header className={styles.authHeading}>
              <p className={styles.eyebrow}>{copy.eyebrow}</p>
              <h2 id="auth-form-heading">{copy.title}</h2>
              <p>{copy.description}</p>
            </header>

            {mode === "forgot" && forgotSent ? (
              <div className={styles.resetConfirmation}>
                <div role="status" className={styles.confirmationBody}>
                  <CheckCircle size={30} aria-hidden="true" />
                  <h3>Check your inbox</h3>
                  <p>
                    If an account exists for <strong>{email}</strong>, a reset
                    link is on its way. It expires in 1 hour.
                  </p>
                  <p>Not there yet? Take a look in your spam folder, too.</p>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className={styles.secondaryButton}
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
                </button>
              </div>
            ) : (
              <form
                className={styles.authForm}
                onSubmit={handleSubmit}
                aria-busy={isSubmitting}
              >
                <fieldset disabled={isSubmitting} className={styles.formFields}>
                  {mode === "signup" && (
                    <label className={styles.field} htmlFor="auth-name">
                      <span>Your name</span>
                      <input
                        id="auth-name"
                        name="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your full name"
                        autoComplete="name"
                      />
                    </label>
                  )}
                  <label className={styles.field} htmlFor="auth-email">
                    <span>Email address</span>
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </label>
                  {mode !== "forgot" && (
                    <div className={styles.field}>
                      <div className={styles.passwordLabel}>
                        <label htmlFor="auth-password">Password</label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => switchMode("forgot")}
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className={styles.passwordInput}>
                        <input
                          id="auth-password"
                          name="password"
                          type={passwordVisible ? "text" : "password"}
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder={
                            mode === "signup"
                              ? "Create a password"
                              : "Enter your password"
                          }
                          aria-describedby={
                            mode === "signup" ? "auth-password-help" : undefined
                          }
                          autoComplete={
                            mode === "signup"
                              ? "new-password"
                              : "current-password"
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPasswordVisible((visible) => !visible)
                          }
                          aria-label={
                            passwordVisible ? "Hide password" : "Show password"
                          }
                          aria-controls="auth-password"
                        >
                          {passwordVisible ? (
                            <EyeSlash size={20} aria-hidden="true" />
                          ) : (
                            <Eye size={20} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {mode === "signup" && (
                        <p id="auth-password-help" className={styles.fieldHint}>
                          Use 6 or more characters, including a number or
                          symbol.
                        </p>
                      )}
                    </div>
                  )}
                </fieldset>

                {error && (
                  <div className={styles.errorMessage} role="alert">
                    <WarningCircle size={20} aria-hidden="true" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.primaryButton}
                >
                  <span aria-live="polite">
                    {isSubmitting ? copy.pending : copy.action}
                  </span>
                  {!isSubmitting && <ArrowRight size={18} aria-hidden="true" />}
                </button>
                {mode === "forgot" ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => switchMode("signin")}
                    className={styles.backLink}
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
                  </button>
                ) : (
                  <p className={styles.authFootnote}>
                    <LockKey size={17} aria-hidden="true" />
                    {mode === "signup"
                      ? "Next: set up your profile and role preferences."
                      : "Your saved search and application history stay with your account."}
                  </p>
                )}
              </form>
            )}
          </div>
          <p className={styles.formFooter}>
            A little structure for a big next step.
          </p>
        </section>
      </div>
    </main>
  );
}
