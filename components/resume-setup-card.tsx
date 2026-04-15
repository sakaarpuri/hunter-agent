"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { RESUME_STYLES, getResumeStyle } from "@/lib/hunteragent-data";
import type { Profile } from "@/lib/hunteragent-types";
import { useHunterAgent } from "./hunteragent-context";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function ResumeSetupCard() {
  const { workspace, draftProfile, setDraftProfile, isSavingDraft } = useHunterAgent();
  const [open, setOpen] = useState(false);

  if (!workspace.onboardingComplete) return null;

  return (
    <div className="mt-6 rounded-[1.9rem] border border-[var(--border-soft)] bg-white shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-5"
      >
        <div className="text-left">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Resume & style</p>
          <p className="mt-1 text-base font-semibold text-[var(--ink)]">
            {draftProfile.resumeMode === "upload" ? "Uploaded base CV" : "Guided resume builder"} · {getResumeStyle(draftProfile.resumeDefaultStyle).label} style
          </p>
        </div>
        <span className="text-[var(--muted)]">
          {open ? <CaretUp size={18} /> : <CaretDown size={18} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border-soft)] px-6 pb-6 pt-5">
          <div className="grid gap-6">

            {/* Resume source */}
            <div className="grid gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Resume source</p>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ["upload", "I already have a CV", "Upload or import a base resume and HunterAgent tailors from it."],
                  ["guided", "Build one for me", "Answer a few essentials and HunterAgent builds a base resume from scratch."],
                ] as [Profile["resumeMode"], string, string][]).map(([value, label, note]) => {
                  const active = draftProfile.resumeMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDraftProfile((c) => ({ ...c, resumeMode: value }))}
                      className={cn(
                        "rounded-[1.5rem] border px-4 py-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                        active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] bg-white",
                      )}
                    >
                      <p className="font-semibold text-[var(--ink)]">{label}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{note}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CV file or guided inputs */}
            {draftProfile.resumeMode === "upload" ? (
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-[var(--ink)]">Master CV file</span>
                <input
                  className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  value={draftProfile.cvFile}
                  onChange={(e) => setDraftProfile((c) => ({ ...c, cvFile: e.target.value }))}
                />
                <span className="text-xs leading-6 text-[var(--muted)]">This becomes the base HunterAgent tailors for each role.</span>
              </label>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm md:col-span-2">
                  <span className="font-medium text-[var(--ink)]">Professional summary</span>
                  <textarea className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]" value={draftProfile.guidedResume.professionalSummary} onChange={(e) => setDraftProfile((c) => ({ ...c, guidedResume: { ...c.guidedResume, professionalSummary: e.target.value } }))} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Recent impact</span>
                  <textarea className="min-h-28 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]" value={draftProfile.guidedResume.recentImpact} onChange={(e) => setDraftProfile((c) => ({ ...c, guidedResume: { ...c.guidedResume, recentImpact: e.target.value } }))} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Experience snapshot</span>
                  <textarea className="min-h-28 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]" value={draftProfile.guidedResume.experienceSnapshot} onChange={(e) => setDraftProfile((c) => ({ ...c, guidedResume: { ...c.guidedResume, experienceSnapshot: e.target.value } }))} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Education</span>
                  <textarea className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]" value={draftProfile.guidedResume.education} onChange={(e) => setDraftProfile((c) => ({ ...c, guidedResume: { ...c.guidedResume, education: e.target.value } }))} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Skills</span>
                  <textarea className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]" value={draftProfile.guidedResume.skills} onChange={(e) => setDraftProfile((c) => ({ ...c, guidedResume: { ...c.guidedResume, skills: e.target.value } }))} />
                </label>
              </div>
            )}

            {/* Style picker with visual previews */}
            <div className="grid gap-3">
              <div className="grid gap-1">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Default style</p>
                <span className="text-xs text-[var(--muted)]">Used first — overridable per job in the studio</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {RESUME_STYLES.map((style) => {
                  const active = draftProfile.resumeDefaultStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setDraftProfile((c) => ({ ...c, resumeDefaultStyle: style.id }))}
                      className={cn(
                        "rounded-[1.55rem] border p-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.99]",
                        active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-soft)] bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-base font-semibold text-[var(--ink)]">{style.label}</h4>
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)]")}>
                          {active ? "Selected" : "Use"}
                        </span>
                      </div>
                      <div className="mt-3 rounded-[1rem] border border-[var(--border-soft)] p-3">
                        <div className="h-3 w-20 rounded-full" style={{ backgroundColor: style.id === "creative" ? "#c67a3f" : "#0f6a62" }} />
                        <div className="mt-3 h-2 w-28 rounded-full bg-[rgba(20,32,30,0.18)]" />
                        <div className="mt-2 h-2 w-full rounded-full bg-[rgba(20,32,30,0.12)]" />
                        <div className="mt-2 h-2 w-4/5 rounded-full bg-[rgba(20,32,30,0.12)]" />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{style.blurb}</p>
                      <p className="mt-2 text-xs leading-6 text-[var(--muted)]">Best for: {style.bestFor}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Work sample links */}
            <div className="grid gap-3">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Work sample links</p>
              {draftProfile.workSampleLinks.map((link, index) => (
                <label key={index} className="grid gap-2 text-sm">
                  <span className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Link {index + 1}</span>
                  <input
                    className="rounded-[1.2rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    value={link}
                    placeholder="https://..."
                    onChange={(e) => setDraftProfile((c) => {
                      const next = [...c.workSampleLinks];
                      next[index] = e.target.value;
                      return { ...c, workSampleLinks: next };
                    })}
                  />
                </label>
              ))}
            </div>

            {isSavingDraft && (
              <p className="text-xs text-[var(--muted)]">Saving…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
