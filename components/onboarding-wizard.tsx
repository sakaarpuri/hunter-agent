"use client";

import { useState, useEffect } from "react";
import {
  REMOTE_REGION_OPTIONS,
  WORKPLACE_MODE_OPTIONS,
  getResumeStyle,
  parsePreferenceList,
} from "@/lib/hunteragent-data";
import { useHunterAgent } from "./hunteragent-context";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const ONBOARDING_STEPS = [
  { id: 1, label: "Profile" },
  { id: 2, label: "Preferences" },
  { id: 3, label: "Delivery" },
] as const;

export function OnboardingWizard() {
  const {
    workspace,
    user,
    draftProfile,
    setDraftProfile,
    draftStep,
    setDraftStep,
    handleFinishOnboarding,
    toggleWorkplaceMode,
    toggleRemoteRegion,
    isSavingDraft,
  } = useHunterAgent();

  const [cvImporting, setCvImporting] = useState(false);
  const [cvImportError, setCvImportError] = useState<string | null>(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);

  // Pre-populate recipient email with the signed-in user's email if not already set
  useEffect(() => {
    if (!draftProfile.recipientEmail && user?.email) {
      setDraftProfile((current) => ({ ...current, recipientEmail: user.email }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (workspace.flowPhase !== "onboarding") return null;

  return (
    <section className="mt-6 grid gap-6 2xl:grid-cols-[1.25fr_0.95fr]">
      <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] pb-4">
          {ONBOARDING_STEPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDraftStep(item.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                draftStep === item.id ? "bg-[var(--accent)] text-white" : item.id < draftStep ? "bg-white text-[var(--ink)]" : "bg-transparent text-[var(--muted)]",
              )}
            >
              {item.id}. {item.label}
            </button>
          ))}
        </div>

        {draftStep === 1 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {/* CV import */}
            <div className="rounded-[1.7rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Import from CV</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                    Upload a PDF or text file and we'll fill in your profile fields automatically.
                  </p>
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCvImporting(true);
                      setCvImportError(null);
                      // Show local preview immediately
                      if (cvPreviewUrl) URL.revokeObjectURL(cvPreviewUrl);
                      if (file.type === "application/pdf") {
                        setCvPreviewUrl(URL.createObjectURL(file));
                      } else {
                        setCvPreviewUrl(null);
                      }
                      setCvFileName(file.name);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/parse-cv", { method: "POST", headers: { "x-requested-with": "XMLHttpRequest" }, body: fd });
                        const data = await res.json() as { ok?: boolean; profile?: Record<string, unknown>; error?: string };
                        if (!res.ok || !data.profile) throw new Error(data.error ?? "Import failed.");
                        const p = data.profile;
                        setDraftProfile((prev) => ({
                          ...prev,
                          name: typeof p.name === "string" && p.name ? p.name : prev.name,
                          currentTitle: typeof p.currentTitle === "string" && p.currentTitle ? p.currentTitle : prev.currentTitle,
                          targetRoles: Array.isArray(p.targetRoles) && (p.targetRoles as string[]).length
                            ? (p.targetRoles as string[]).slice(0, 3)
                            : prev.targetRoles,
                          locations: typeof p.locations === "string" && p.locations ? p.locations : prev.locations,
                          coreStrength: typeof p.coreStrength === "string" && p.coreStrength ? p.coreStrength : prev.coreStrength,
                        }));
                      } catch (err) {
                        setCvImportError(err instanceof Error ? err.message : "Import failed.");
                      } finally {
                        setCvImporting(false);
                      }
                    }}
                  />
                  <span className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300",
                    cvImporting
                      ? "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] cursor-not-allowed"
                      : "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] hover:-translate-y-0.5"
                  )}>
                    {cvImporting ? "Importing…" : "Choose file"}
                  </span>
                </label>
              </div>
              {cvImportError && (
                <p className="mt-3 text-sm text-rose-600">{cvImportError}</p>
              )}
              {cvFileName && !cvImportError && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-[var(--muted)]">{cvFileName}</p>
                  {cvPreviewUrl ? (
                    <iframe
                      src={cvPreviewUrl}
                      className="h-[340px] w-full rounded-[1.1rem] border border-[var(--border-soft)] bg-white"
                      title="CV preview"
                    />
                  ) : (
                    <div className="flex h-16 items-center justify-center rounded-[1.1rem] border border-[var(--border-soft)] bg-white text-sm text-[var(--muted)]">
                      Text file imported — fields filled above.
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="grid min-w-0 gap-2 text-sm">
              <span className="font-medium text-[var(--ink)]">Name</span>
              <input className="w-full rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.name} onChange={(event) => setDraftProfile((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="grid min-w-0 gap-2 text-sm">
              <span className="font-medium text-[var(--ink)]">Current title</span>
              <input className="w-full rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.currentTitle} onChange={(event) => setDraftProfile((current) => ({ ...current, currentTitle: event.target.value }))} />
            </label>
            {draftProfile.targetRoles.map((role, index) => (
              <label key={index} className="grid min-w-0 gap-2 text-sm">
                <span className="font-medium text-[var(--ink)]">Target role {index + 1}</span>
                <input
                  className="w-full rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                  value={role}
                  onChange={(event) =>
                    setDraftProfile((current) => {
                      const next = [...current.targetRoles];
                      next[index] = event.target.value;
                      return { ...current, targetRoles: next };
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}

        {draftStep === 2 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Locations</span>
              <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.locations} onChange={(event) => setDraftProfile((current) => ({ ...current, locations: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--ink)]">Salary or rate range</span>
              <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.salary} onChange={(event) => setDraftProfile((current) => ({ ...current, salary: event.target.value }))} />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-[var(--ink)]">Core strength</span>
              <input className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none" value={draftProfile.coreStrength} onChange={(event) => setDraftProfile((current) => ({ ...current, coreStrength: event.target.value }))} />
            </label>
            <div className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Work types</span>
              <div className="flex flex-wrap gap-2">
                {["Full-time", "Part-time", "Contract"].map((type) => {
                  const active = draftProfile.workTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setDraftProfile((current) => ({
                          ...current,
                          workTypes: active
                            ? current.workTypes.filter((item) => item !== type)
                            : [...current.workTypes, type],
                        }))
                      }
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--ink)]",
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Workplace</span>
              <div className="flex flex-wrap gap-2">
                {WORKPLACE_MODE_OPTIONS.map((option) => {
                  const active = draftProfile.workplaceModes.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleWorkplaceMode(option.id)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--ink)]",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Region</span>
              <div className="flex flex-wrap gap-2">
                {REMOTE_REGION_OPTIONS.map((option) => {
                  const active = draftProfile.remoteRegions.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleRemoteRegion(option.id)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--ink)]",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs leading-6 text-[var(--muted)]">Used when a posting limits which regions can apply.</span>
            </div>
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Special preferences</span>
              <textarea
                className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                value={draftProfile.specialPreferences.join(", ")}
                onChange={(event) =>
                  setDraftProfile((current) => ({
                    ...current,
                    specialPreferences: parsePreferenceList(event.target.value),
                  }))
                }
                placeholder="Comma-separated, e.g. B2B SaaS, 4-day week, healthcare AI"
              />
            </label>
          </div>
        )}

        {draftStep === 3 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Daily brief recipient</span>
              <input
                type="email"
                className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                value={draftProfile.recipientEmail}
                onChange={(event) => setDraftProfile((current) => ({ ...current, recipientEmail: event.target.value }))}
                placeholder="you@example.com"
              />
              <span className="text-xs leading-6 text-[var(--muted)]">HunterAgent sends the daily brief here, then waits for reply selections from the same inbox.</span>
            </label>
            <div className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">Brief schedule</span>
              <div className="flex gap-2">
                <input
                  type="time"
                  className="w-32 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                  value={draftProfile.briefTime}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, briefTime: event.target.value }))}
                />
                <input
                  className="min-w-0 flex-1 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
                  value={draftProfile.timezone}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, timezone: event.target.value }))}
                  placeholder="Europe/London"
                />
              </div>
              <span className="text-xs leading-6 text-[var(--muted)]">Time and timezone your brief lands every morning.</span>
            </div>
            <div className="grid gap-3 text-sm md:col-span-2">
              <span className="font-medium text-[var(--ink)]">First shortlist</span>
              {/* Send immediately — checkbox style, checked by default */}
              <button
                type="button"
                onClick={() => setDraftProfile((current) => ({ ...current, firstBrief: current.firstBrief === "now" ? "scheduled" : "now" }))}
                className="flex items-center gap-3 rounded-[1.3rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <span className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                  draftProfile.firstBrief === "now"
                    ? "bg-[var(--accent)]"
                    : "border-2 border-[var(--border-strong)] bg-white",
                )}>
                  {draftProfile.firstBrief === "now" && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l2.5 2.5 5.5-5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="font-medium text-[var(--ink)]">Send the first brief immediately</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">Roles arrive right after you finish setup</p>
                </div>
              </button>
              {/* Wait option */}
              <button
                type="button"
                onClick={() => setDraftProfile((current) => ({ ...current, firstBrief: "scheduled" }))}
                className={cn(
                  "rounded-[1.3rem] border px-4 py-3 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                  draftProfile.firstBrief === "scheduled"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)]",
                )}
              >
                Wait until the scheduled time
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-5">
          <button
            type="button"
            onClick={() => setDraftStep((current) => Math.max(1, current - 1))}
            disabled={draftStep === 1}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {draftStep < ONBOARDING_STEPS.length ? (
            <button
              type="button"
              onClick={() => setDraftStep((current) => Math.min(ONBOARDING_STEPS.length, current + 1))}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
            >
              Finish setup
            </button>
          )}
        </div>
      </div>

      <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Preview</p>
        <div className="mt-4 rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
          <h3 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
            Resume source: {draftProfile.resumeMode === "upload" ? "Uploaded base CV" : "HunterAgent guided builder"}
          </h3>
        </div>
      </div>
    </section>
  );
}
