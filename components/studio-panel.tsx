"use client";

import React from "react";
import {
  CheckCircle,
  PaperPlaneTilt,
  Palette,
  PencilSimple,
  Sparkle,
} from "@phosphor-icons/react";
import { RESUME_STYLES, formatAppliedDate, getResumeStyle } from "@/lib/hunteragent-data";
import { CvPreview } from "@/components/cv-preview";
import { TrustExplanationPanel } from "@/components/trust-explanation-panel";
import { useHunterAgent } from "./hunteragent-context";
import type { AppliedRecord, PackTarget, StudioTab } from "@/lib/hunteragent-types";
import type { CvViewMode, Tone } from "@/lib/hunteragent-types";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const PROCESSING_STAGES = [
  "Analysing the roles you selected",
  "Drafting your resume and cover letter",
  "Selecting the best supporting materials",
] as const;

const EDIT_PROMPT_SUGGESTIONS = ["Make it more direct", "Focus on growth work", "Sound more senior"] as const;

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderMarkdown(text: string) {
  return text.split("\n").map((line, index) => {
    if (line.startsWith("### ")) return <h4 key={index} className="mt-4 font-semibold text-[var(--ink)]">{line.slice(4)}</h4>;
    if (line.startsWith("## ")) return <h3 key={index} className="mt-5 text-base font-semibold text-[var(--ink)]">{line.slice(3)}</h3>;
    if (line.startsWith("# ")) return <h2 key={index} className="mt-6 text-lg font-semibold text-[var(--ink)]">{line.slice(2)}</h2>;
    if (line.startsWith("- ") || line.startsWith("* ")) return <li key={index} className="ml-4 list-disc">{renderInline(line.slice(2))}</li>;
    if (line.trim() === "") return <br key={index} />;
    return <p key={index}>{renderInline(line)}</p>;
  });
}

function targetFromStudioTab(tab: StudioTab): PackTarget {
  if (tab === "cv") return "cv";
  if (tab === "letter") return "letter";
  if (tab === "workSamples") return "workSamples";
  return "pack";
}

function targetLabel(target: PackTarget) {
  if (target === "cv") return "CV";
  if (target === "letter") return "cover letter";
  if (target === "workSamples") return "work sample reasoning";
  return "pack";
}

export function StudioPanel() {
  const {
    workspace,
    activeRole,
    activePack,
    appliedDetails,
    draftProfile,
    editInstruction,
    setEditInstruction,
    designReferenceOpen,
    setDesignReferenceOpen,
    trustPanelOpen,
    setTrustPanelOpen,
    isGenerating,
    effectiveStyle,
    showWorkSamplesTab,
    visibleStudioTabs,
    promptHistory,
    trustExplanation,
    handleSharpenPack,
    handleSectionEdit,
    handleSuggestionClick,
    handleEditCurrentTabOnly,
    handleClearPrompt,
    handleStudioTab,
    handleToneChange,
    handleCvViewMode,
    handleRoleStyle,
    handleMakeDefaultStyle,
    handleExportCvPreview,
    handleMarkApplied,
    handleFollowUpPlan,
    generationStage,
  } = useHunterAgent();

  function handleExportPlainText() {
    if (!activePack) return;
    const lines: string[] = [];
    lines.push(draftProfile.name);
    if (draftProfile.currentTitle) lines.push(draftProfile.currentTitle);
    if (draftProfile.locations) lines.push(draftProfile.locations);
    lines.push("");
    if (activePack.cvSummary) {
      lines.push("SUMMARY");
      lines.push(activePack.cvSummary);
      lines.push("");
    }
    if (activePack.cvBullets.length > 0) {
      lines.push("EXPERIENCE");
      for (const bullet of activePack.cvBullets) {
        lines.push(`• ${bullet}`);
      }
    }
    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draftProfile.name.replace(/\s+/g, "_")}_CV.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-[var(--surface)] px-5 py-6 lg:px-6 xl:px-7">
      {workspace.flowPhase !== "studio" || !activeRole || !activePack ? (
        <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workspace preview</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {workspace.flowPhase === "onboarding"
              ? "Your studio opens here once setup is complete."
              : workspace.flowPhase === "waiting"
                ? "Waiting for your first brief to arrive."
                : workspace.flowPhase === "brief"
                  ? "Choose your roles and your materials will appear here."
                  : "Preparing your application materials…"}
          </h3>
          <div className="mt-5 grid gap-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-[1.5rem] border border-dashed border-[var(--border-soft)] bg-[var(--surface)]" />
            ))}
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
            {workspace.flowPhase === "processing"
              ? `${PROCESSING_STAGES[generationStage]}…`
              : "Select roles from your email to start building your application materials. Your CV, cover letter, and follow-up draft will appear here."}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Application studio</p>
            <div className="mt-4 border-b border-[var(--border-soft)] pb-4">
              <h3 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{activeRole.company}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {activeRole.title} · {activeRole.location} · {activeRole.employment} · Posted {activeRole.posted}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              {visibleStudioTabs.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void handleStudioTab(value)}
                  className={cn(
                    "rounded-full px-3.5 py-2 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                    workspace.studioTab === value ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-white text-[var(--muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {([
                ["balanced", "Balanced"],
                ["direct", "More direct"],
                ["warm", "Warmer"],
              ] as Array<[Tone, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void handleToneChange(value)}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-xs font-medium transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                    workspace.tone === value ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)] text-[var(--muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Refinement prompt</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    Adjust only what needs changing. Use this to edit just the current section without rewriting the whole pack.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)]">
                    Active target: {targetLabel(targetFromStudioTab(workspace.studioTab))}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPrompt}
                    className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    Clear prompt
                  </button>
                </div>
              </div>
              <textarea
                value={editInstruction}
                onChange={(event) => setEditInstruction(event.target.value)}
                placeholder="Example: Make the cover letter more direct and emphasize growth work."
                className="mt-4 min-h-28 w-full rounded-[1.2rem] border border-[var(--border-soft)] bg-white px-4 py-3 text-sm leading-7 text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {EDIT_PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-full border border-[var(--border-soft)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              {promptHistory.length > 0 && (
                <div className="mt-4 border-t border-[var(--border-soft)] pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Recent for this role and section</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {promptHistory.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => setEditInstruction(entry)}
                        className="rounded-full border border-[var(--border-soft)] bg-white px-3.5 py-2 text-xs font-medium text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {workspace.studioTab === "cv" && (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs font-medium">
                    {([
                      ["preview", "Preview"],
                      ["content", "Content"],
                    ] as Array<[CvViewMode, string]>).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => void handleCvViewMode(mode)}
                        className={cn(
                          "rounded-full px-3.5 py-2 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                          workspace.cvViewMode === mode ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-white text-[var(--muted)]",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleExportCvPreview}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                    >
                      <PaperPlaneTilt size={16} />
                      Export PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPlainText}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                    >
                      Export plain text
                    </button>
                  </div>
                </div>

                {workspace.cvViewMode === "preview" ? (
                  <CvPreview profile={draftProfile} pack={activePack} role={activeRole} styleId={effectiveStyle} />
                ) : (
                  <>
                    <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Resume summary</p>
                          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{activePack.cvSummary}</p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                          {activePack.resumeSourceType === "upload" ? "Uploaded base CV" : "Guided base resume"}
                        </div>
                      </div>
                    </div>

                    {activePack.cvBullets.map((bullet) => (
                      <div key={bullet} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 text-[var(--muted)]">
                        {bullet}
                      </div>
                    ))}
                  </>
                )}

                <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Design reference</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">Keep this tucked away unless you want to change the visual direction.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDesignReferenceOpen((current) => !current)}
                      className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                    >
                      {designReferenceOpen ? "Collapse" : "Open"}
                    </button>
                  </div>

                  {designReferenceOpen && (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {RESUME_STYLES.map((style) => {
                          const active = effectiveStyle === style.id;
                          return (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => void handleRoleStyle(style.id)}
                              className={cn(
                                "rounded-[1.45rem] border p-4 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.99]",
                                active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-soft)] bg-white",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="font-semibold text-[var(--ink)]">{style.label}</h4>
                                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", active ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)]")}>{active ? "Current" : "Use"}</span>
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

                      <button
                        type="button"
                        onClick={() => void handleMakeDefaultStyle(effectiveStyle)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                      >
                        <Palette size={16} />
                        Make {getResumeStyle(effectiveStyle).label} the default style
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {workspace.studioTab === "letter" && (
              <div className="mt-6 rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                {renderMarkdown(activePack.letter)}
              </div>
            )}

            {workspace.studioTab === "workSamples" && (
              <div className="mt-6 space-y-3">
                {activePack.workSampleSelections.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                    No work samples needed for this role — your CV and cover letter are the strongest application here.
                  </div>
                ) : activePack.workSampleSelections.map((item) => (
                  <div key={`${item.title}-${item.note}`} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-[var(--ink)]">{item.title}</h4>
                        {item.href && <p className="mt-2 text-xs font-mono text-[var(--accent)]">{item.href}</p>}
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--muted)]">Work sample</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{item.note}</p>
                  </div>
                ))}
              </div>
            )}

            {workspace.studioTab === "pack" && (
              <div className="mt-6 space-y-4">
                <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-7 text-[var(--muted)]">
                  {activePack.reasoning}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    `Resume · ${getResumeStyle(activePack.resumeStyleUsed).label}`,
                    `Cover letter · ${workspace.tone}`,
                    showWorkSamplesTab ? `Work samples · ${activePack.workSampleSelections.length} picks` : "Work samples · not in scope",
                    `Provider · ${activePack.provider === "anthropic" ? "AI (Claude)" : activePack.provider === "fallback" ? "Template" : activePack.provider}`,
                  ].map((item) => (
                    <div key={item} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white px-4 py-4 text-sm font-medium text-[var(--ink)]">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trustExplanation && (
              <div className="mt-6 rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Trust layer</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      See how this CV, cover letter, and work sample selection were put together.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrustPanelOpen((current) => !current)}
                    className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                  >
                    {trustPanelOpen ? "Hide trust details" : "Open trust details"}
                  </button>
                </div>

                {trustPanelOpen && (
                  <div className="mt-4">
                    <TrustExplanationPanel explanation={trustExplanation} />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleEditCurrentTabOnly()}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]"
              >
                <PencilSimple size={16} weight="fill" />
                {isGenerating ? "Updating" : `Edit ${targetLabel(targetFromStudioTab(workspace.studioTab))} only`}
              </button>
              <button
                type="button"
                onClick={() => void handleSharpenPack()}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]"
              >
                <Sparkle size={16} weight="fill" />
                Regenerate all
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleMarkApplied}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]"
              >
                <CheckCircle size={16} weight="fill" />
                Mark applied
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([
                ["cv", "Edit CV only"],
                ["letter", "Edit cover letter only"],
                ...(showWorkSamplesTab ? ([["workSamples", "Edit work samples only"]] as Array<[PackTarget, string]>) : []),
              ] as Array<[PackTarget, string]>).map(([target, label]) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => void handleSectionEdit(target)}
                  disabled={isGenerating}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] disabled:cursor-not-allowed disabled:opacity-45 enabled:hover:-translate-y-0.5 enabled:active:translate-y-[1px] enabled:active:scale-[0.98]",
                    workspace.studioTab === target
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border-soft)] bg-white text-[var(--ink)]",
                  )}
                >
                  <Sparkle size={16} />
                  {label}
                </button>
              ))}
            </div>

            {activePack.provider === "fallback" && (
              <div className="mt-4 rounded-[1.45rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
                These materials were built automatically from your profile. They&apos;re a solid starting point — review and edit before sending.
              </div>
            )}
          </div>

          <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Applied timeline</p>
            {appliedDetails.length === 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm leading-7 text-[var(--muted)]">
                No applications logged yet. Mark a role as applied from the studio to track it here.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {appliedDetails.map((item) => (
                  <div key={item.roleId} className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{item.role.company}</h4>
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.role.title} · Applied {formatAppliedDate(item.appliedAt)}</p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--muted)]">
                        {getResumeStyle(item.resumeStyleUsed).label} · {item.provider}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      {item.followUp === "off" ? "No follow-up reminder set." : `Follow-up reminder: in ${item.followUp} days.`}{" "}
                      {item.followUpDueAt ? `Due ${formatAppliedDate(item.followUpDueAt)}.` : ""}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                      {([
                        ["off", "Follow-up off"],
                        ["7", "Remind in 7 days"],
                        ["14", "Remind in 14 days"],
                      ] as Array<[AppliedRecord["followUp"], string]>).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => void handleFollowUpPlan(item.roleId, value)}
                          className={cn(
                            "rounded-full px-3.5 py-2 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
                            item.followUp === value ? "bg-[var(--accent)] text-white" : "border border-[var(--border-soft)] bg-white text-[var(--muted)]",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {item.followUpDraft && (
                      <div className="mt-4 rounded-[1.4rem] border border-[var(--border-soft)] bg-white p-4 text-sm leading-7 whitespace-pre-line text-[var(--muted)]">
                        {item.followUpDraft}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
