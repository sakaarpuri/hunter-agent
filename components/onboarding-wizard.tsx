"use client";

import { ResumeSetupCard } from "./resume-setup-card";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  FileArrowUp,
  SlidersHorizontal,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import {
  REMOTE_REGION_OPTIONS,
  WORKPLACE_MODE_OPTIONS,
  parsePreferenceList,
} from "@/lib/hunteragent-data";
import { useHunterAgent } from "./hunteragent-context";
import styles from "./account-flow.module.css";

const ONBOARDING_STEPS = [
  {
    id: 1,
    label: "Profile",
    title: "Start with your story.",
    description:
      "Bring your experience. Our agents will help you find where it belongs next.",
    next: "Set your preferences",
  },
  {
    id: 2,
    label: "Preferences",
    title: "Define your next move.",
    description:
      "Tell us what a good fit looks like, so your search has a clear direction.",
    next: "Choose delivery",
  },
  {
    id: 3,
    label: "Delivery",
    title: "Find your search rhythm.",
    description:
      "Choose how often our agents search and when your shortlist can arrive.",
    next: "Finish setup",
  },
] as const;

export function BriefPreferences() {
  const { draftProfile, setDraftProfile, isSavingPreferences } = useHunterAgent();
  return (
    <div className={styles.briefPreferences}>
      <section className={styles.fieldGroup} aria-labelledby="daily-brief-heading">
        <h3 id="daily-brief-heading" className={styles.fieldHeading}>Your daily brief</h3>
        <div className={styles.briefPromise}>
          <span className={styles.optionTitle}>Up to 3 standout matches</span>
          <span className={styles.optionDescription}>Only genuine new matches. No repeats or padding, and no email when nothing qualifies.</span>
        </div>
      </section>
      <fieldset className={styles.fieldGroup} disabled={isSavingPreferences}>
        <legend>Search cadence</legend>
        <div className={styles.optionGrid}>
          {([
            ["daily", "Daily", "Look for worthwhile new opportunities every day. The default."],
            ["three-per-week", "Three times a week", "A quieter search rhythm."],
          ] as const).map(([cadence, label, description]) => (
            <button key={cadence} type="button" className={styles.optionButton}
              aria-pressed={(draftProfile.discoveryCadence ?? "daily") === cadence}
              onClick={() => setDraftProfile((current) => ({ ...current, discoveryCadence: cadence }))}>
              <span className={styles.optionTitle}>{label}</span>
              <span className={styles.optionDescription}>{description}</span>
            </button>
          ))}
        </div>
        <p className={styles.groupHint}>Search cadence controls when our agents look for jobs. Daily email time is separate: it is the delivery window for new matches, not a promise of a daily email.</p>
      </fieldset>
      <p className={styles.groupHint}>Suggested jobs stay for seven days from first discovery, even if selected. Applied history and generated documents are kept separately. Selecting a job never starts AI writing.</p>
    </div>
  );
}

export function ExplorationPreference() {
  const { draftProfile, setDraftProfile, isSavingPreferences } = useHunterAgent();
  const options = [
    ["close", "Close Match", "Stay close to the roles you named."],
    ["stretch", "A Little Stretch", "Mostly close matches, with one credible adjacent possibility."],
    ["surprise", "Surprise Me", "More adjacent possibilities, always grounded in your experience."],
  ] as const;
  return (
    <fieldset className={styles.fieldGroup} disabled={isSavingPreferences}>
      <legend>How adventurous should the search be?</legend>
      <div className={styles.optionGrid}>
        {options.map(([value, title, description]) => (
          <button key={value} type="button" className={styles.optionButton}
            aria-pressed={draftProfile.explorationMode === value}
            onClick={() => setDraftProfile((current) => ({ ...current, explorationMode: value }))}>
            <span className={styles.optionTitle}>{title}</span>
            <span className={styles.optionDescription}>{description}</span>
          </button>
        ))}
      </div>
      <p className={styles.groupHint}>Your location, work style, employment type, and excluded employers always stay fixed.</p>
    </fieldset>
  );
}

function MoveCriteriaField() {
  const { draftProfile, setDraftProfile } = useHunterAgent();
  const [text, setText] = useState(() =>
    draftProfile.specialPreferences.join(", "),
  );
  return (
    <div className={styles.field}>
      <label htmlFor="setup-special-preferences">
        What would make a move worth it?
      </label>
      <textarea
        id="setup-special-preferences"
        aria-describedby="setup-special-help"
        rows={3}
        value={text}
        onChange={(event) => {
          // Preserve commas and spaces while typing; store normalized preferences.
          setText(event.target.value);
          setDraftProfile((current) => ({
            ...current,
            specialPreferences: parsePreferenceList(event.target.value),
          }));
        }}
        placeholder="e.g. climate mission, 4-day week, leadership scope, open to South Korea"
      />
      <p id="setup-special-help" className={styles.fieldHint}>
        Happy in your current job? Set a high bar. Add your ambitions and
        non-negotiables, separated by commas.
      </p>
    </div>
  );
}

export function OnboardingWizard() {
  const {
    workspace,
    user,
    isDesignPreview,
    draftProfile,
    setDraftProfile,
    draftStep,
    setDraftStep,
    handleFinishOnboarding,
    toggleWorkplaceMode,
    toggleRemoteRegion,
    isSavingDraft,
    clientError,
  } = useHunterAgent();

  const [cvImporting, setCvImporting] = useState(false);
  const [cvImportError, setCvImportError] = useState<string | null>(null);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(draftStep);
  const currentStep =
    ONBOARDING_STEPS.find((step) => step.id === draftStep) ??
    ONBOARDING_STEPS[0];
  const busy = cvImporting || isFinishing;

  // Keep the existing first-visit email and timezone defaults.
  useEffect(() => {
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDraftProfile((current) => ({
      ...current,
      ...(!current.recipientEmail && user?.email
        ? { recipientEmail: user.email }
        : {}),
      ...(detectedTz && current.timezone === "Europe/London"
        ? { timezone: detectedTz }
        : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previousStep.current !== draftStep) {
      stepHeading.current?.focus({ preventScroll: true });
      stepHeading.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      previousStep.current = draftStep;
    }
  }, [draftStep]);

  useEffect(
    () => () => {
      if (cvPreviewUrl) URL.revokeObjectURL(cvPreviewUrl);
    },
    [cvPreviewUrl],
  );

  async function importCv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || cvImporting) return;
    if (isDesignPreview) {
      event.target.value = "";
      setCvImportError(
        "CV import is disabled in this local preview. Use the example profile to explore setup.",
      );
      return;
    }
    // Allow the same file to be selected again after a failed import.
    event.target.value = "";
    setCvImporting(true);
    setCvImportError(null);
    setCvPreviewUrl(
      file.type === "application/pdf" ? URL.createObjectURL(file) : null,
    );
    setCvFileName(file.name);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-cv", {
        method: "POST",
        headers: { "x-requested-with": "XMLHttpRequest" },
        body: fd,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        profile?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok || !data.profile)
        throw new Error(
          data.error ??
            "We couldn't read this file. Try another PDF or text file, or enter your details below.",
        );
      const p = data.profile;
      setDraftProfile((prev) => ({
        ...prev,
        name: typeof p.name === "string" && p.name ? p.name : prev.name,
        currentTitle:
          typeof p.currentTitle === "string" && p.currentTitle
            ? p.currentTitle
            : prev.currentTitle,
        targetRoles:
          Array.isArray(p.targetRoles) && (p.targetRoles as string[]).length
            ? (p.targetRoles as string[]).slice(0, 3)
            : prev.targetRoles,
        locations:
          typeof p.locations === "string" && p.locations
            ? p.locations
            : prev.locations,
        coreStrength:
          typeof p.coreStrength === "string" && p.coreStrength
            ? p.coreStrength
            : prev.coreStrength,
        cvFile: file.name,
        resumeMode: "upload" as const,
      }));
    } catch (err) {
      setCvImportError(
        err instanceof Error
          ? err.message
          : "We couldn't import your CV. You can still enter your details below.",
      );
    } finally {
      setCvImporting(false);
    }
  }

  async function finishSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (draftStep < ONBOARDING_STEPS.length) {
      setDraftStep((current) => Math.min(ONBOARDING_STEPS.length, current + 1));
      return;
    }
    setIsFinishing(true);
    setFinishError(null);
    try {
      await handleFinishOnboarding();
    } catch (err) {
      setFinishError(
        err instanceof Error
          ? err.message
          : "We couldn't finish setup. Your entries are still here; please try again.",
      );
    } finally {
      setIsFinishing(false);
    }
  }

  if (workspace.flowPhase !== "onboarding") return null;

  return (
    <section className={styles.wizard} aria-label="Set up your job search">
      <div className={styles.wizardMain}>
        <nav className={styles.stepNav} aria-label="Setup steps">
          <ol>
            {ONBOARDING_STEPS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setDraftStep(item.id)}
                  disabled={busy}
                  aria-current={draftStep === item.id ? "step" : undefined}
                >
                  <span className={styles.stepNumber}>0{item.id}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.stepContent}>
          <header className={styles.stepHeading}>
            <p className={styles.eyebrow}>
              YOUR SEARCH, YOUR TERMS <span>STEP 0{draftStep} / 03</span>
            </p>
            <h2 ref={stepHeading} tabIndex={-1}>
              {currentStep.title}
            </h2>
            <p>{currentStep.description}</p>
          </header>

          <form onSubmit={finishSetup} aria-busy={busy}>
            <fieldset disabled={isFinishing} className={styles.formFields}>
              {draftStep === 1 && (
                <div className={styles.stepFields}>
                  <div className={styles.cvImport}>
                    <div className={styles.importHeading}>
                      <FileArrowUp size={27} aria-hidden="true" />
                      <div>
                        <h3>A head start, from your CV</h3>
                        <p>
                          Import a PDF or text file to fill your profile, or
                          start with the fields below.
                        </p>
                      </div>
                      <label className={styles.fileButton}>
                        <input
                          type="file"
                          accept=".pdf,.txt"
                          disabled={cvImporting}
                          onChange={importCv}
                          aria-label="Import your CV"
                        />
                        <span>
                          {cvImporting ? "Reading CV..." : "Choose file"}
                        </span>
                      </label>
                    </div>
                    {cvImportError && (
                      <div role="alert" className={styles.errorMessage}>
                        <WarningCircle size={18} aria-hidden="true" />
                        <p>{cvImportError}</p>
                      </div>
                    )}
                    <div role="status">
                      {cvImporting && (
                        <p className={styles.importStatus}>
                          Reading your experience and filling in the details...
                        </p>
                      )}
                      {cvFileName && !cvImportError && !cvImporting && (
                        <p className={styles.importStatus}>
                          <CheckCircle size={17} aria-hidden="true" />{" "}
                          {cvFileName} imported. Review your details below.
                        </p>
                      )}
                    </div>
                    {cvPreviewUrl && !cvImportError && !cvImporting && (
                      <details className={styles.cvPreview}>
                        <summary>Preview uploaded CV</summary>
                        <iframe src={cvPreviewUrl} title="CV preview" />
                      </details>
                    )}
                  </div>
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Your name</span>
                      <input
                        autoComplete="name"
                        value={draftProfile.name}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Current title</span>
                      <input
                        autoComplete="organization-title"
                        placeholder="e.g. Product designer"
                        value={draftProfile.currentTitle}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            currentTitle: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <fieldset className={styles.fieldGroup}>
                    <legend>What roles are you looking for?</legend>
                    <p className={styles.groupHint}>
                      Use specific titles to give your search a useful starting
                      point.
                    </p>
                    <div className={styles.roleFields}>
                      {draftProfile.targetRoles.map((role, index) => (
                        <label key={index} className={styles.field}>
                          <span>Target role {index + 1}</span>
                          <input
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
                  </fieldset>
                  <ResumeSetupCard duringSetup />
                </div>
              )}

              {draftStep === 2 && (
                <div className={styles.stepFields}>
                  <div className={styles.fieldGrid}>
                    <label className={`${styles.field} ${styles.fullWidth}`}>
                      <span>Locations</span>
                      <input
                        placeholder="e.g. London, Remote, Berlin"
                        value={draftProfile.locations}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            locations: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Salary or rate range</span>
                      <input
                        placeholder="Include currency and period"
                        value={draftProfile.salary}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            salary: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Core strength</span>
                      <input
                        placeholder="What do you do best?"
                        value={draftProfile.coreStrength}
                        onChange={(event) =>
                          setDraftProfile((current) => ({
                            ...current,
                            coreStrength: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <fieldset className={styles.fieldGroup}>
                    <legend>
                      Work types <span>Select all that fit</span>
                    </legend>
                    <div className={styles.chipGroup}>
                      {["Full-time", "Part-time", "Contract"].map((type) => {
                        const active = draftProfile.workTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            className={styles.choiceChip}
                            aria-pressed={active}
                            onClick={() =>
                              setDraftProfile((current) => ({
                                ...current,
                                workTypes: active
                                  ? current.workTypes.filter(
                                      (item) => item !== type,
                                    )
                                  : [...current.workTypes, type],
                              }))
                            }
                          >
                            {active && <Check size={14} aria-hidden="true" />}
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className={styles.fieldGroup}>
                    <legend>
                      Workplace <span>Select all that fit</span>
                    </legend>
                    <div className={styles.chipGroup}>
                      {WORKPLACE_MODE_OPTIONS.map((option) => {
                        const active = draftProfile.workplaceModes.includes(
                          option.id,
                        );
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={styles.choiceChip}
                            aria-pressed={active}
                            onClick={() => toggleWorkplaceMode(option.id)}
                          >
                            {active && <Check size={14} aria-hidden="true" />}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className={styles.fieldGroup}>
                    <legend>How would you like to prepare applications?</legend>
                    <div className={styles.optionGrid}>
                      {(
                        [
                          {
                            value: "ai",
                            title: "Help me write them",
                            description:
                              "Tailor a CV and cover letter to each role you choose. Review them before applying.",
                          },
                          {
                            value: "self",
                            title: "I'll bring my own",
                            description:
                              "Prepare your documents outside HunterAgent. Track your applications and follow-ups here.",
                          },
                        ] as const
                      ).map((option) => {
                        const active =
                          option.value === "ai"
                            ? draftProfile.materialsMode !== "self"
                            : draftProfile.materialsMode === "self";
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={styles.optionButton}
                            aria-pressed={active}
                            onClick={() =>
                              setDraftProfile((current) => ({
                                ...current,
                                materialsMode: option.value,
                              }))
                            }
                          >
                            <span className={styles.optionTitle}>
                              <span>{option.title}</span>
                              <span
                                className={styles.selectionMark}
                                aria-hidden="true"
                              >
                                {active && <Check size={12} weight="bold" />}
                              </span>
                            </span>
                            <span className={styles.optionDescription}>
                              {option.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <MoveCriteriaField />
                  <ExplorationPreference />
                  <details className={styles.advancedPreferences}>
                    <summary>
                      <SlidersHorizontal size={19} aria-hidden="true" />
                      <span>
                        Remote-work eligibility
                        <small>Choose where remote roles can employ you</small>
                      </span>
                      <span className={styles.expandMark} aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <div className={styles.advancedContent}>
                      <fieldset className={styles.fieldGroup}>
                        <legend>Regions you can work in</legend>
                        <p className={styles.groupHint}>
                          Used when a posting limits which regions can apply.
                        </p>
                        <div className={styles.chipGroup}>
                          {REMOTE_REGION_OPTIONS.map((option) => {
                            const active = draftProfile.remoteRegions.includes(
                              option.id,
                            );
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={styles.choiceChip}
                                aria-pressed={active}
                                onClick={() => toggleRemoteRegion(option.id)}
                              >
                                {active && (
                                  <Check size={14} aria-hidden="true" />
                                )}
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    </div>
                  </details>
                </div>
              )}

              {draftStep === 3 && (
                <div className={styles.stepFields}>
                  <div className={styles.field}>
                    <label htmlFor="setup-recipient">
                      Brief recipient
                    </label>
                    <input
                      id="setup-recipient"
                      type="email"
                      autoComplete="email"
                      value={draftProfile.recipientEmail}
                      onChange={(event) =>
                        setDraftProfile((current) => ({
                          ...current,
                          recipientEmail: event.target.value,
                        }))
                      }
                      placeholder="you@example.com"
                      aria-describedby="brief-email-help"
                    />
                    <p id="brief-email-help" className={styles.fieldHint}>
                      We&apos;ll send your brief here. Reply from this inbox to
                      select your roles.
                    </p>
                  </div>
                  <BriefPreferences />
                  <fieldset className={styles.fieldGroup}>
                    <legend>Daily email delivery window</legend>
                    <div className={styles.scheduleGrid}>
                      <label className={styles.field}>
                        <span>Daily email time</span>
                        <input
                          type="time"
                          value={draftProfile.briefTime}
                          onChange={(event) =>
                            setDraftProfile((current) => ({
                              ...current,
                              briefTime: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Timezone</span>
                        <input
                          value={draftProfile.timezone}
                          onChange={(event) =>
                            setDraftProfile((current) => ({
                              ...current,
                              timezone: event.target.value,
                            }))
                          }
                          placeholder="Europe/London"
                        />
                      </label>
                    </div>
                    <p className={styles.groupHint}>
                      We check for unsent new matches at this local time. No new matches means no email.
                    </p>
                  </fieldset>
                  <fieldset className={styles.fieldGroup}>
                    <legend>When should we start?</legend>
                    <div className={styles.deliveryOptions}>
                      <button
                        type="button"
                        className={styles.optionButton}
                        aria-pressed={draftProfile.firstBrief === "now"}
                        onClick={() =>
                          setDraftProfile((current) => ({
                            ...current,
                            firstBrief:
                              current.firstBrief === "now"
                                ? "scheduled"
                                : "now",
                          }))
                        }
                      >
                        <span className={styles.optionTitle}>
                          <span>Send my first brief immediately</span>
                          <span
                            className={styles.selectionMark}
                            aria-hidden="true"
                          >
                            {draftProfile.firstBrief === "now" && (
                              <Check size={12} weight="bold" />
                            )}
                          </span>
                        </span>
                        <span className={styles.optionDescription}>
                          Start finding roles as soon as you finish setup.
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.optionButton}
                        aria-pressed={draftProfile.firstBrief === "scheduled"}
                        onClick={() =>
                          setDraftProfile((current) => ({
                            ...current,
                            firstBrief: "scheduled",
                          }))
                        }
                      >
                        <span className={styles.optionTitle}>
                          <span>Wait until my scheduled time</span>
                          <span
                            className={styles.selectionMark}
                            aria-hidden="true"
                          >
                            {draftProfile.firstBrief === "scheduled" && (
                              <Check size={12} weight="bold" />
                            )}
                          </span>
                        </span>
                        <span className={styles.optionDescription}>
                          Begin at your next delivery window, if new matches are ready.
                        </span>
                      </button>
                    </div>
                  </fieldset>
                  <div className={styles.deliveryNote}>
                    <CheckCircle size={20} aria-hidden="true" />
                    <p>
                      You&apos;re in control. You choose the roles, review your
                      materials, and decide when to apply.
                    </p>
                  </div>
                </div>
              )}
            </fieldset>
            {(finishError || clientError) && (
              <div className={styles.errorMessage} role="alert">
                <WarningCircle size={20} aria-hidden="true" />
                <p>{finishError || clientError}</p>
              </div>
            )}
            <footer className={styles.wizardFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={draftStep === 1 || busy}
                onClick={() =>
                  setDraftStep((current) => Math.max(1, current - 1))
                }
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <span className={styles.saveStatus} role="status">
                {isSavingDraft
                  ? "Saving changes..."
                  : "You can update this later"}
              </span>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={busy}
              >
                <span aria-live="polite">
                  {isFinishing
                    ? "Finishing setup..."
                    : cvImporting
                      ? "Reading CV..."
                      : currentStep.next}
                </span>
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </footer>
          </form>
        </div>
      </div>

      <aside
        className={styles.searchSummary}
        aria-labelledby="setup-summary-title"
      >
        <div className={styles.summaryHeading}>
          <span className={styles.eyebrow}>TAKING SHAPE</span>
          <span className={styles.summaryDot} aria-hidden="true" />
        </div>
        <h2 id="setup-summary-title">Your next chapter.</h2>
        <p className={styles.summaryIntro}>
          A search built around what matters to you.
        </p>
        <dl className={styles.summaryList}>
          <div>
            <dt>
              Your direction
              <button
                type="button"
                onClick={() => setDraftStep(1)}
                disabled={busy}
                aria-label="Edit profile and target roles"
              >
                Edit
              </button>
            </dt>
            <dd>
              {draftProfile.targetRoles
                .filter((role) => role.trim())
                .join(" / ") || "Add your target roles"}
            </dd>
          </div>
          <div>
            <dt>
              Your ideal fit
              <button
                type="button"
                onClick={() => setDraftStep(2)}
                disabled={busy}
                aria-label="Edit role preferences"
              >
                Edit
              </button>
            </dt>
            <dd>{draftProfile.locations || "Add your preferred locations"}</dd>
            <dd className={styles.summaryDetail}>
              {draftProfile.workTypes.join(" / ") || "Choose your work types"}
            </dd>
            {!!draftProfile.workplaceModes.length && (
              <dd className={styles.summaryDetail}>
                {WORKPLACE_MODE_OPTIONS.filter((option) =>
                  draftProfile.workplaceModes.includes(option.id),
                )
                  .map((option) => option.label)
                  .join(" / ")}
              </dd>
            )}
          </div>
          {draftProfile.specialPreferences.length > 0 && (
            <div>
              <dt>Worth a move for</dt>
              <dd>{draftProfile.specialPreferences.join(" / ")}</dd>
            </div>
          )}
          <div>
            <dt>Search range</dt>
            <dd>{draftProfile.explorationMode === "close" ? "Close Match" : draftProfile.explorationMode === "surprise" ? "Surprise Me" : "A Little Stretch"}</dd>
            <dd className={styles.summaryDetail}>Hard preferences stay fixed.</dd>
          </div>
          <div>
            <dt>Your application materials</dt>
            <dd>
              {draftProfile.materialsMode === "self"
                ? "Prepared by you"
                : "AI-assisted, reviewed by you"}
            </dd>
            <dd className={styles.summaryDetail}>
              {draftProfile.resumeMode === "upload" && draftProfile.cvFile
                ? "Using your uploaded base CV"
                : "Using your profile details"}
            </dd>
          </div>
          <div>
            <dt>
              Your brief
              <button
                type="button"
                onClick={() => setDraftStep(3)}
                disabled={busy}
                aria-label="Edit brief delivery"
              >
                Edit
              </button>
            </dt>
            <dd>
              Up to 3 new matches
            </dd>
            <dd className={styles.summaryDetail}>
              Search: {draftProfile.discoveryCadence === "daily" ? "Daily" : "Three times a week"}
            </dd>
            <dd>
              Email window: {" "}
              {draftProfile.briefTime || "Choose a time"}
              <span className={styles.summaryDetail}>
                {" "}
                {draftProfile.timezone.replaceAll("_", " ")}
              </span>
            </dd>
            <dd className={styles.summaryDetail}>
              {draftProfile.recipientEmail || "Add your delivery email"}
            </dd>
            <dd className={styles.summaryDetail}>
              {draftProfile.firstBrief === "now"
                ? "First brief: after setup"
                : "First brief: at your scheduled time"}
            </dd>
          </div>
        </dl>
        <div className={styles.summaryTip}>
          <span className={styles.tipNumber}>0{draftStep}</span>
          <p>
            {draftStep === 1
              ? "A specific role title is more useful than a broad industry. Think about the work you want to do."
              : draftStep === 2
                ? "Be clear about the essentials. Use special preferences for the details that make a role feel right."
                : "One last look. You can revisit any step before finishing, or update your preferences later."}
          </p>
        </div>
      </aside>
    </section>
  );
}
