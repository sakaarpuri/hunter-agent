"use client";

import React, { useId, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  CaretDown,
  CheckCircle,
  FileText,
  Info,
  Palette,
  PencilSimple,
  Printer,
  SlidersHorizontal,
  Sparkle,
} from "@phosphor-icons/react";
import {
  RESUME_STYLES,
  formatAppliedDate,
  getResumeStyle,
} from "@/lib/hunteragent-data";
import { CvPreview } from "@/components/cv-preview";
import { TrustExplanationPanel } from "@/components/trust-explanation-panel";
import { useHunterAgent } from "./hunteragent-context";
import type {
  AppliedRecord,
  CvViewMode,
  PackTarget,
  StudioTab,
  Tone,
} from "@/lib/hunteragent-types";
import "./studio-panel.css";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const PROCESSING_STAGES = [
  "Analysing the roles you selected",
  "Drafting your CV and cover letter",
  "Selecting supporting materials",
] as const;

const EDIT_PROMPT_SUGGESTIONS = [
  "Make it more direct",
  "Focus on growth work",
  "Sound more senior",
] as const;

function renderInline(text: string): React.ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (/^[-*] /.test(line)) {
      const start = i;
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i]))
        items.push(lines[i++].slice(2));
      i--;
      blocks.push(
        <ul key={start}>
          {items.map((item, index) => (
            <li key={index}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
    } else if (line.startsWith("### ")) {
      blocks.push(<h4 key={i}>{renderInline(line.slice(4))}</h4>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h3 key={i}>{renderInline(line.slice(3))}</h3>);
    } else if (line.startsWith("# ")) {
      blocks.push(<h2 key={i}>{renderInline(line.slice(2))}</h2>);
    } else {
      blocks.push(<p key={i}>{renderInline(line)}</p>);
    }
  }
  return blocks;
}

function targetLabel(target: PackTarget) {
  if (target === "cv") return "CV";
  if (target === "letter") return "cover letter";
  if (target === "workSamples") return "work sample notes";
  return "application pack";
}

function safeSampleUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// Manual tab activation avoids firing persisted workspace updates while arrowing through tabs.
function moveTabFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not(:disabled)',
    ) ?? [],
  );
  if (!tabs.length) return;
  const current = tabs.indexOf(event.currentTarget);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  event.preventDefault();
  tabs[next].focus();
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
  const id = useId();
  const [refinementOpen, setRefinementOpen] = useState(false);
  const [isMarkingApplied, setIsMarkingApplied] = useState(false);
  const selectedTab = visibleStudioTabs.some(
    ([value]) => value === workspace.studioTab,
  )
    ? workspace.studioTab
    : "cv";
  const currentApplication = appliedDetails.find(
    (item) => item.roleId === activeRole?.id,
  );
  const isSelfManaged = draftProfile.materialsMode === "self";
  const isFallback = activePack?.provider === "fallback";
  const isReady = workspace.flowPhase === "studio" && activeRole && activePack;

  function handleExportPlainText() {
    if (!activePack) return;
    const lines = [draftProfile.name];
    if (draftProfile.currentTitle) lines.push(draftProfile.currentTitle);
    if (draftProfile.locations) lines.push(draftProfile.locations);
    lines.push("");
    if (activePack.cvSummary) lines.push("SUMMARY", activePack.cvSummary, "");
    if (activePack.cvBullets.length)
      lines.push(
        "EXPERIENCE",
        ...activePack.cvBullets.map((bullet) => `- ${bullet}`),
      );
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(draftProfile.name || "Candidate").replace(/\s+/g, "_")}_CV.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function markApplied() {
    setIsMarkingApplied(true);
    try {
      await handleMarkApplied();
    } finally {
      setIsMarkingApplied(false);
    }
  }

  function renderDocument(tab: StudioTab) {
    if (!activePack || !activeRole) return null;
    if (tab === "cv") {
      return workspace.cvViewMode === "preview" ? (
        <CvPreview
          profile={draftProfile}
          pack={activePack}
          role={activeRole}
          styleId={effectiveStyle}
          className="studio-cv-pages"
        />
      ) : (
        <article className="studio-paper studio-prose" aria-label="CV content">
          <p className="studio-eyebrow">
            {activePack.resumeSourceType === "upload"
              ? "Based on your uploaded CV"
              : "Based on your guided resume"}
          </p>
          <h2 className="studio-document-name">
            {draftProfile.name || "Your CV"}
          </h2>
          {draftProfile.currentTitle && (
            <p className="studio-document-subtitle">
              {draftProfile.currentTitle}
            </p>
          )}
          <h3>Professional summary</h3>
          <p>
            {activePack.cvSummary ||
              "No summary is available yet. Use Refine to generate one."}
          </p>
          <h3>Experience highlights</h3>
          <ul>
            {activePack.cvBullets.map((bullet, index) => (
              <li key={index}>{renderInline(bullet)}</li>
            ))}
          </ul>
        </article>
      );
    }
    if (tab === "letter") {
      return (
        <article
          className="studio-paper studio-prose"
          aria-label="Cover letter draft"
        >
          <header className="studio-letter-heading">
            <p className="studio-eyebrow">Cover letter</p>
            <h2>{activeRole.company}</h2>
            <p>{activeRole.title}</p>
          </header>
          {activePack.letter ? (
            renderMarkdown(activePack.letter)
          ) : (
            <p>
              No cover letter is available yet. Use Refine to generate a draft.
            </p>
          )}
        </article>
      );
    }
    if (tab === "workSamples" && showWorkSamplesTab) {
      return (
        <article className="studio-paper">
          <p className="studio-eyebrow">Supporting evidence</p>
          <h2 className="studio-section-title mt-2">Work samples</h2>
          <p className="studio-note mt-2">
            Review the suggested evidence and confirm each link before including
            it.
          </p>
          {!activePack.workSampleSelections.length ? (
            <p className="studio-note mt-6">
              No work samples are selected for this role.
            </p>
          ) : (
            <ol className="studio-samples">
              {activePack.workSampleSelections.map((item, index) => {
                const href = safeSampleUrl(item.href);
                return (
                  <li key={`${item.title}-${index}`}>
                    <span className="studio-sample-number" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="studio-note mt-2">{item.note}</p>
                      {href ? (
                        <a
                          className="studio-sample-link"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open work sample{" "}
                          <ArrowUpRight size={14} aria-hidden="true" />
                          <span className="sr-only">
                            : {item.title} (opens in a new tab)
                          </span>
                        </a>
                      ) : (
                        <p className="studio-note mt-2">
                          {item.href
                            ? "This sample needs a valid web link."
                            : "No link attached. Add the sample separately when applying."}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </article>
      );
    }
    return (
      <article className="studio-paper">
        <p className="studio-eyebrow">Application overview</p>
        <h2 className="studio-section-title mt-2">
          The thinking behind this pack
        </h2>
        <p className="studio-note mt-4">
          {activePack.reasoning ||
            "Review each document against the role requirements before applying."}
        </p>
        <dl className="studio-summary-list">
          <div>
            <dt>CV layout</dt>
            <dd>{getResumeStyle(effectiveStyle).label}</dd>
          </div>
          <div>
            <dt>Draft tone</dt>
            <dd className="capitalize">{activePack.tone}</dd>
          </div>
          {showWorkSamplesTab && (
            <div>
              <dt>Work samples</dt>
              <dd>{activePack.workSampleSelections.length} selected</dd>
            </div>
          )}
          <div>
            <dt>Draft source</dt>
            <dd>
              {isFallback
                ? "Profile-based template"
                : "AI-generated with Claude"}
            </dd>
          </div>
        </dl>
        <p className="studio-note">
          A draft, not a submitted application. Check names, dates, claims, and
          links before you send it.
        </p>
      </article>
    );
  }

  return (
    <section className="hunter-studio" aria-label="Application studio">
      {!isReady ? (
        <div className="studio-empty">
          <p className="studio-eyebrow">Application studio</p>
          <FileText
            className="studio-empty-icon"
            size={32}
            aria-hidden="true"
          />
          <h2 className="studio-section-title">
            {workspace.flowPhase === "onboarding"
              ? "A space for your next move."
              : workspace.flowPhase === "waiting"
                ? "Your next opportunity starts with a brief."
                : workspace.flowPhase === "brief"
                  ? "Choose a role. Make it yours."
                  : "Your application is taking shape."}
          </h2>
          <p className="studio-note mt-3 max-w-lg">
            {workspace.flowPhase === "onboarding"
              ? "Complete your profile to prepare role-specific application materials here."
              : workspace.flowPhase === "waiting"
                ? "When your brief arrives, select the roles you want to pursue. Your materials will appear here."
                : workspace.flowPhase === "brief"
                  ? "Select roles from your brief to begin. Review your CV and cover letter, then refine only what needs changing."
                  : "Keep this workspace open while your drafts are prepared."}
          </p>
          {workspace.flowPhase === "processing" ? (
            <div className="studio-processing" role="status" aria-live="polite">
              <span className="studio-status-dot" />
              {PROCESSING_STAGES[generationStage] ??
                "Preparing your application materials"}
              ...
            </div>
          ) : (
            <div className="studio-empty-outline" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          <p className="studio-empty-footer">
            Review first. Refine with purpose. Apply when ready.
          </p>
        </div>
      ) : (
        <>
          <header className="studio-header">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="studio-eyebrow">Application studio</p>
              <span className="studio-status" role="status" aria-live="polite">
                {isGenerating ? (
                  <>
                    <span className="studio-status-dot" /> Updating draft...
                  </>
                ) : currentApplication ? (
                  <>
                    <CheckCircle size={14} aria-hidden="true" /> Applied
                  </>
                ) : isSelfManaged ? (
                  "Self-managed"
                ) : (
                  "Draft for review"
                )}
              </span>
            </div>
            <h2 className="studio-role-title">{activeRole.company}</h2>
            <p className="studio-role-subtitle">{activeRole.title}</p>
            <p className="studio-role-meta">
              {[
                activeRole.location,
                activeRole.employment,
                activeRole.posted && (/^post(?:ed|ing)\b/i.test(activeRole.posted) ? activeRole.posted : `Posted ${activeRole.posted}`),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {activeRole.sourceUrl?.startsWith("https://") && (
              <a className="text-link mt-3" href={activeRole.sourceUrl} target="_blank" rel="noopener noreferrer">
                Open original job listing <ArrowUpRight size={14} />
              </a>
            )}
          </header>

          {isSelfManaged ? (
            <div className="studio-paper studio-self-managed">
              <FileText size={25} aria-hidden="true" />
              <h3 className="studio-section-title mt-4">
                Your materials. Your process.
              </h3>
              <p className="studio-note mt-3">
                Prepare and submit your own CV and cover letter outside
                HunterAgent. This workspace can track when you apply and your
                follow-up plan.
              </p>
              <p className="studio-note mt-3">
                Document uploads are not available in this studio yet.
              </p>
            </div>
          ) : (
            <>
              <div className="studio-source-notice">
                <Info size={16} aria-hidden="true" />
                <p>
                  <strong>
                    {isFallback ? "Template draft" : "AI-assisted draft"}.
                  </strong>{" "}
                  {isFallback
                    ? "Built from your profile without AI generation. Review and refine before sending."
                    : "Generated with Claude. Check every claim against your experience before sending."}
                </p>
              </div>
              <div
                className="studio-tab-bar"
                role="tablist"
                aria-label="Application documents"
              >
                {visibleStudioTabs.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${value}`}
                    aria-controls={`${id}-panel-${value}`}
                    aria-selected={selectedTab === value}
                    tabIndex={selectedTab === value ? 0 : -1}
                    onKeyDown={moveTabFocus}
                    onClick={() => void handleStudioTab(value)}
                    disabled={isGenerating}
                    className={cn(
                      "studio-tab",
                      selectedTab === value && "is-active",
                    )}
                  >
                    {value === "pack" ? "Overview" : label}
                  </button>
                ))}
              </div>
              <div className="studio-document-toolbar">
                {selectedTab === "cv" ? (
                  <div
                    className="studio-segmented"
                    role="group"
                    aria-label="CV view"
                  >
                    {(
                      [
                        ["preview", "Document"],
                        ["content", "Text"],
                      ] as Array<[CvViewMode, string]>
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={workspace.cvViewMode === mode}
                        disabled={isGenerating}
                        onClick={() => void handleCvViewMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="studio-note">
                    {selectedTab === "letter"
                      ? "Cover letter draft"
                      : selectedTab === "workSamples"
                        ? "Evidence for this role"
                        : "Your application at a glance"}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={cn(
                      "studio-button studio-button-small",
                      refinementOpen && "is-selected",
                    )}
                    aria-expanded={refinementOpen}
                    aria-controls={`${id}-refinement`}
                    onClick={() => setRefinementOpen(!refinementOpen)}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" /> Refine{" "}
                    <CaretDown
                      size={12}
                      className={cn(
                        "studio-caret",
                        refinementOpen && "is-open",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {selectedTab === "cv" && (
                    <button
                      type="button"
                      className="studio-button studio-button-primary studio-button-small"
                      onClick={handleExportCvPreview}
                      disabled={isGenerating}
                      aria-describedby={`${id}-print-help`}
                    >
                      <Printer size={16} aria-hidden="true" /> Print / save PDF
                    </button>
                  )}
                </div>
              </div>
              {selectedTab === "cv" && (
                <p id={`${id}-print-help`} className="studio-export-note">
                  Opens your browser&apos;s print dialog. Choose Save as PDF to
                  download.
                </p>
              )}

              <div
                className={cn(
                  "studio-workbench",
                  refinementOpen && "has-refinement",
                )}
              >
                <aside
                  id={`${id}-refinement`}
                  className="studio-refinement"
                  hidden={!refinementOpen}
                  aria-label="Refine application materials"
                >
                  <p className="studio-eyebrow">Refine your draft</p>
                  <h3 className="studio-refinement-title">
                    A focused edit, not a fresh start.
                  </h3>
                  <p className="studio-note mt-2">
                    {selectedTab === "pack"
                      ? "You are editing the whole application pack."
                      : `Changes apply to your ${targetLabel(selectedTab)} only.`}
                  </p>
                  <label
                    className="studio-field-label mt-5"
                    htmlFor={`${id}-instruction`}
                  >
                    What would you like to change?
                  </label>
                  <textarea
                    id={`${id}-instruction`}
                    value={editInstruction}
                    onChange={(event) => setEditInstruction(event.target.value)}
                    placeholder="e.g. Lead with my product systems experience."
                    rows={4}
                    disabled={isGenerating}
                    className="studio-textarea"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EDIT_PROMPT_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="studio-suggestion"
                        disabled={isGenerating}
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="studio-button studio-button-primary"
                      disabled={isGenerating}
                      onClick={() =>
                        selectedTab === workspace.studioTab
                          ? handleEditCurrentTabOnly()
                          : handleSectionEdit(selectedTab)
                      }
                    >
                      <PencilSimple size={15} aria-hidden="true" />
                      {isGenerating
                        ? "Updating..."
                        : `${editInstruction.trim() ? "Update" : "Refresh"} ${targetLabel(selectedTab)}`}
                    </button>
                    <button
                      type="button"
                      className="studio-text-button"
                      disabled={isGenerating || !editInstruction.trim()}
                      onClick={handleClearPrompt}
                    >
                      Clear
                    </button>
                  </div>
                  {promptHistory.length > 0 && (
                    <details className="studio-subdetails">
                      <summary>
                        Recent instructions <span>{promptHistory.length}</span>
                      </summary>
                      <div className="mt-3 grid gap-2">
                        {promptHistory.map((entry) => (
                          <button
                            type="button"
                            key={entry}
                            className="studio-suggestion text-left"
                            disabled={isGenerating}
                            onClick={() => setEditInstruction(entry)}
                          >
                            {entry}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  <details className="studio-subdetails">
                    <summary>
                      Whole-pack changes{" "}
                      <Sparkle size={15} aria-hidden="true" />
                    </summary>
                    <p className="studio-note mt-3">
                      Changing the tone regenerates all materials for this role,
                      not just the open document.
                    </p>
                    <fieldset className="mt-4" disabled={isGenerating}>
                      <legend className="studio-field-label">
                        Tone for the whole pack
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          [
                            ["balanced", "Balanced"],
                            ["direct", "Direct"],
                            ["warm", "Warm"],
                          ] as Array<[Tone, string]>
                        ).map(([tone, label]) => (
                          <button
                            type="button"
                            className="studio-suggestion"
                            aria-pressed={workspace.tone === tone}
                            disabled={isGenerating || workspace.tone === tone}
                            onClick={() => void handleToneChange(tone)}
                            key={tone}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      type="button"
                      className="studio-button mt-4"
                      disabled={isGenerating}
                      onClick={() => void handleSharpenPack()}
                    >
                      <Sparkle size={15} aria-hidden="true" /> Sharpen pack
                    </button>
                  </details>
                  {selectedTab === "cv" && (
                    <div className="studio-subdetails">
                      <button
                        className="studio-disclosure"
                        type="button"
                        aria-expanded={designReferenceOpen}
                        aria-controls={`${id}-design`}
                        onClick={() =>
                          setDesignReferenceOpen(!designReferenceOpen)
                        }
                      >
                        <span>
                          <Palette size={15} aria-hidden="true" /> CV layout
                        </span>
                        <span>
                          {getResumeStyle(effectiveStyle).label}
                          <CaretDown size={12} aria-hidden="true" />
                        </span>
                      </button>
                      <div id={`${id}-design`} hidden={!designReferenceOpen}>
                        <p className="studio-note mt-3">
                          Change the presentation of your CV without rewriting
                          its content.
                        </p>
                        <div className="studio-style-grid">
                          {RESUME_STYLES.map((style) => (
                            <button
                              key={style.id}
                              type="button"
                              className="studio-style-option"
                              aria-pressed={effectiveStyle === style.id}
                              disabled={isGenerating}
                              onClick={() => void handleRoleStyle(style.id)}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <strong>{style.label}</strong>
                                {effectiveStyle === style.id && (
                                  <CheckCircle size={16} aria-hidden="true" />
                                )}
                              </span>
                              <span className={`studio-style-thumbnail is-${style.id}`} aria-hidden="true">
                                <span className="thumbnail-header" />
                                <span className="thumbnail-sidebar" />
                                <span className="thumbnail-lines"><i /><i /><i /><i /></span>
                              </span>
                              <span className="studio-note">{style.blurb}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="studio-text-button mt-3"
                          disabled={isGenerating}
                          onClick={() =>
                            void handleMakeDefaultStyle(effectiveStyle)
                          }
                        >
                          Make {getResumeStyle(effectiveStyle).label} my default
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
                <div className="studio-document-area" aria-busy={isGenerating}>
                  {visibleStudioTabs.map(([tab]) => (
                    <div
                      key={tab}
                      role="tabpanel"
                      id={`${id}-panel-${tab}`}
                      aria-labelledby={`${id}-tab-${tab}`}
                      tabIndex={0}
                      hidden={selectedTab !== tab}
                    >
                      {selectedTab === tab && renderDocument(tab)}
                    </div>
                  ))}
                </div>
              </div>
              {selectedTab === "cv" && (
                <div className="studio-document-footer">
                  <span>
                    {getResumeStyle(effectiveStyle).label} layout{" "}
                    <span aria-hidden="true">·</span> Review before sending
                  </span>
                  <button
                    type="button"
                    className="studio-text-button"
                    disabled={isGenerating}
                    onClick={handleExportPlainText}
                  >
                    <ArrowDown size={14} aria-hidden="true" /> Download plain
                    text
                  </button>
                </div>
              )}

              {(trustExplanation || activePack.reasoning) && (
                <section className="studio-trust">
                  <button
                    type="button"
                    className="studio-disclosure"
                    aria-expanded={trustPanelOpen}
                    aria-controls={`${id}-trust`}
                    onClick={() => setTrustPanelOpen(!trustPanelOpen)}
                  >
                    <span>
                      <Info size={17} aria-hidden="true" /> How this draft was
                      put together
                    </span>
                    <CaretDown
                      size={15}
                      className={cn(
                        "studio-caret",
                        trustPanelOpen && "is-open",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <p className="studio-note mt-1">
                    Source material, tailoring decisions, and inferred details.
                  </p>
                  <div
                    id={`${id}-trust`}
                    hidden={!trustPanelOpen}
                    className="studio-trust-content"
                  >
                    <p className="studio-note">
                      These explanations describe the inputs and decisions, not
                      an independent fact-check.
                    </p>
                    {activePack.reasoning && (
                      <p className="studio-note mt-3">{activePack.reasoning}</p>
                    )}
                    {trustExplanation && (
                      <TrustExplanationPanel
                        explanation={trustExplanation}
                        className="studio-trust-details mt-5"
                      />
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          <footer className="studio-application-action">
            <div>
              <h3 className="text-sm font-semibold">
                {currentApplication
                  ? "Application recorded"
                  : "Already sent your application?"}
              </h3>
              <p className="studio-note mt-1">
                {currentApplication
                  ? `Marked applied on ${formatAppliedDate(currentApplication.appliedAt)}.`
                  : "Mark it here to track it in Applications. This does not submit anything."}
              </p>
            </div>
            <button
              type="button"
              className="studio-button"
              onClick={() => void markApplied()}
              disabled={
                isGenerating || isMarkingApplied || !!currentApplication
              }
            >
              <CheckCircle size={17} aria-hidden="true" />
              {isMarkingApplied
                ? "Recording..."
                : currentApplication
                  ? "Applied"
                  : "Mark applied"}
            </button>
          </footer>
          <section
            className="studio-timeline"
            aria-labelledby={`${id}-timeline-heading`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3
                id={`${id}-timeline-heading`}
                className="studio-section-title"
              >
                Application log
              </h3>
              <span className="studio-note">
                {appliedDetails.length} recorded
              </span>
            </div>
            {appliedDetails.length === 0 ? (
              <p className="studio-note mt-3">
                Nothing logged yet. Your applications and follow-up plans will
                appear here.
              </p>
            ) : (
              <div className="mt-4">
                {appliedDetails.map((item) => (
                  <article key={item.roleId} className="studio-timeline-entry">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{item.role.company}</h4>
                        <p className="studio-note mt-1">{item.role.title}</p>
                      </div>
                      <span className="studio-note">
                        Applied {formatAppliedDate(item.appliedAt)}
                      </span>
                    </div>
                    <p className="studio-note mt-3">
                      {item.followUp === "off"
                        ? "No follow-up planned."
                        : item.followUpDueAt
                          ? `Follow-up due ${formatAppliedDate(item.followUpDueAt)}.`
                          : `Follow-up planned for ${item.followUp} days after applying.`}
                    </p>
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      role="group"
                      aria-label={`Follow-up for ${item.role.title} at ${item.role.company}`}
                    >
                      {(
                        [
                          ["off", "Off"],
                          ["7", "7 days"],
                          ["14", "14 days"],
                        ] as Array<[AppliedRecord["followUp"], string]>
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className="studio-suggestion"
                          aria-pressed={item.followUp === value}
                          onClick={() =>
                            void handleFollowUpPlan(item.roleId, value)
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {item.followUpDraft && (
                      <details className="studio-followup-draft">
                        <summary>Review follow-up draft</summary>
                        <p className="studio-note mt-3 whitespace-pre-line">
                          {item.followUpDraft}
                        </p>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
