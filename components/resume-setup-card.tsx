"use client";

import { RESUME_STYLES } from "@/lib/hunteragent-data";
import type { GuidedResumeInput } from "@/lib/hunteragent-types";
import { useHunterAgent } from "./hunteragent-context";

const fields: Array<[keyof GuidedResumeInput, string, string]> = [
  [
    "professionalSummary",
    "Professional summary",
    "What you do and the strengths you bring",
  ],
  ["experienceSnapshot", "Experience", "Roles, employers, and dates"],
  [
    "recentImpact",
    "Recent impact",
    "Specific projects, results, and outcomes you can verify",
  ],
  ["education", "Education", "Qualifications and institutions"],
  ["skills", "Skills", "Your relevant tools, methods, and areas of expertise"],
];

export function ResumeSetupCard({
  duringSetup = false,
}: {
  duringSetup?: boolean;
}) {
  const {
    workspace,
    draftProfile,
    setDraftProfile,
    handlePreferenceSave,
    isSavingPreferences,
  } = useHunterAgent();
  if (!workspace.onboardingComplete && !duringSetup) return null;
  return (
    <details className="resume-source-settings">
      <summary>
        {duringSetup
          ? "Add experience without uploading a CV"
          : "Your resume, work samples, and default style"}
        <span>Optional details</span>
      </summary>
      <div className="resume-source-body">
        <p>
          Give the writer specific facts to work with. Include only experience
          and results you can stand behind.
        </p>
        {draftProfile.cvFile && (
          <p className="resume-import-note">
            Imported file: {draftProfile.cvFile}. These details supplement your
            imported profile.
          </p>
        )}
        <div className="resume-source-fields">
          {fields.map(([key, label, hint]) => (
            <label key={key}>
              <span>{label}</span>
              <textarea
                value={draftProfile.guidedResume[key]}
                placeholder={hint}
                rows={3}
                onChange={(e) =>
                  setDraftProfile((current) => ({
                    ...current,
                    resumeMode: current.cvFile ? "upload" : "guided",
                    guidedResume: {
                      ...current.guidedResume,
                      [key]: e.target.value,
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
        <label className="resume-style-select">
          <span>Default CV layout</span>
          <select
            value={draftProfile.resumeDefaultStyle}
            onChange={(e) =>
              setDraftProfile((current) => ({
                ...current,
                resumeDefaultStyle: e.target
                  .value as typeof current.resumeDefaultStyle,
              }))
            }
          >
            {RESUME_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </label>
        <div className="resume-samples">
          <h3>Work samples</h3>
          <p>
            Optional. Include relevant projects, writing, case studies, or other
            evidence.
          </p>
          {draftProfile.workSampleLinks.map((url, index) => (
            <div key={index}>
              <label>
                <span>Work sample {index + 1}</span>
                <input
                  type="url"
                  value={url}
                  placeholder="https://..."
                  onChange={(e) =>
                    setDraftProfile((current) => ({
                      ...current,
                      workSampleLinks: current.workSampleLinks.map((v, i) =>
                        i === index ? e.target.value : v,
                      ),
                    }))
                  }
                />
              </label>
              <button
                aria-label={`Remove work sample ${index + 1}`}
                onClick={() =>
                  setDraftProfile((current) => ({
                    ...current,
                    workSampleLinks: current.workSampleLinks.filter(
                      (_, i) => i !== index,
                    ),
                  }))
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="text-link"
            onClick={() =>
              setDraftProfile((current) => ({
                ...current,
                workSampleLinks: [...current.workSampleLinks, ""],
              }))
            }
          >
            + Add work sample
          </button>
        </div>
        {!duringSetup && (
          <button
            className="button button-accent"
            disabled={isSavingPreferences}
            onClick={() => void handlePreferenceSave()}
          >
            {isSavingPreferences ? "Saving..." : "Save resume details"}
          </button>
        )}
      </div>
    </details>
  );
}
