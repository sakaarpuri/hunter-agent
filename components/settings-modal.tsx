"use client";

import { useState } from "react";
import {
  REMOTE_REGION_OPTIONS,
  WORKPLACE_MODE_OPTIONS,
  parsePreferenceList,
} from "@/lib/hunteragent-data";
import { useHunterAgent } from "./hunteragent-context";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    settingsName,
    setSettingsName,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    settingsError,
    settingsNotice,
    isSavingSettings,
    isSavingPreferences,
    draftProfile,
    setDraftProfile,
    handleSettingsNameSave,
    handlePasswordChange,
    handlePreferenceSave,
    toggleWorkplaceMode,
    toggleRemoteRegion,
  } = useHunterAgent();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not delete account.");
      }
      window.location.href = "/";
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete account.");
      setIsDeleting(false);
    }
  }

  if (!isSettingsOpen) return null;

  return (
    <section className="mt-6 rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Account settings</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">Manage your account.</h2>
        </div>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(false)}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--ink)]"
        >
          Close
        </button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--ink)]">Edit name</p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            This is the name shown in your dashboard.
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Display name</span>
            <input
              value={settingsName}
              onChange={(event) => setSettingsName(event.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            onClick={handleSettingsNameSave}
            disabled={isSavingSettings}
            className="mt-4 inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            Save name
          </button>
        </div>

        <form onSubmit={handlePasswordChange} className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--ink)]">Change password</p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Choose a strong password — at least 6 characters, with one number or symbol.
          </p>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-[var(--ink)]">Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-[var(--ink)]">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <button
            type="submit"
            disabled={isSavingSettings}
            className="mt-4 inline-flex items-center rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Update password
          </button>
        </form>
      </div>

      <div className="mt-5 rounded-[1.7rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">Job search settings</p>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              These settings shape which roles get matched and whether your daily email is active.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePreferenceSave}
            disabled={isSavingPreferences}
            className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSavingPreferences ? "Saving…" : "Save settings"}
          </button>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Brief status</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Pause your daily email if you need a break. Your settings and history are kept.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDraftProfile((current) => ({ ...current, briefsPaused: false }))}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  !draftProfile.briefsPaused ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                )}
              >
                Daily briefs on
              </button>
              <button
                type="button"
                onClick={() => setDraftProfile((current) => ({ ...current, briefsPaused: true }))}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  draftProfile.briefsPaused ? "bg-amber-600 text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                )}
              >
                Pause briefs
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Application materials</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Choose whether HunterAgent writes your CV and cover letter, or you manage your own materials and use the dashboard for tracking.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setDraftProfile((current) => ({ ...current, materialsMode: "ai" as const }))}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  draftProfile.materialsMode !== "self" ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                )}
              >
                AI writes my materials
              </button>
              <button
                type="button"
                onClick={() => setDraftProfile((current) => ({ ...current, materialsMode: "self" as const }))}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  draftProfile.materialsMode === "self" ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                )}
              >
                I manage my own
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Recipient and timing</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className="font-medium text-[var(--ink)]">Daily brief recipient</span>
                <input
                  type="email"
                  className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                  value={draftProfile.recipientEmail}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, recipientEmail: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-[var(--ink)]">Daily brief time</span>
                <input
                  type="time"
                  className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                  value={draftProfile.briefTime}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, briefTime: event.target.value }))}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium text-[var(--ink)]">Timezone</span>
                <input
                  className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                  value={draftProfile.timezone}
                  onChange={(event) => setDraftProfile((current) => ({ ...current, timezone: event.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4 xl:col-span-2">
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Locations</span>
                  <input
                    className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                    value={draftProfile.locations}
                    onChange={(event) => setDraftProfile((current) => ({ ...current, locations: event.target.value }))}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Salary or rate range</span>
                  <input
                    className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                    value={draftProfile.salary}
                    onChange={(event) => setDraftProfile((current) => ({ ...current, salary: event.target.value }))}
                  />
                </label>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2 text-sm">
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
                            "rounded-full px-4 py-2 text-sm font-medium",
                            active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                          )}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
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
                            "rounded-full px-4 py-2 text-sm font-medium",
                            active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Remote work region</span>
                  <div className="flex flex-wrap gap-2">
                    {REMOTE_REGION_OPTIONS.map((option) => {
                      const active = draftProfile.remoteRegions.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleRemoteRegion(option.id)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-medium",
                            active ? "bg-[var(--accent)] text-white" : "border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)]",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-[var(--ink)]">Special preferences</span>
                  <textarea
                    placeholder="e.g. no agencies, startups only, no relocation"
                    className="min-h-24 rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)] outline-none"
                    value={draftProfile.specialPreferences.join(", ")}
                    onChange={(event) =>
                      setDraftProfile((current) => ({
                        ...current,
                        specialPreferences: parsePreferenceList(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handlePreferenceSave}
            disabled={isSavingPreferences}
            className="inline-flex items-center rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSavingPreferences ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      {(settingsError || settingsNotice) && (
        <div
          className={cn(
            "mt-5 rounded-2xl px-4 py-3 text-sm",
            settingsError
              ? "border border-rose-200 bg-rose-50 text-rose-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {settingsError ?? settingsNotice}
        </div>
      )}

      <div className="mt-6 rounded-[1.7rem] border border-red-100 bg-red-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">Danger zone</p>
        {!showDeleteConfirm ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-[var(--muted)]">Permanently delete your account and all application data. This cannot be undone.</p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="mt-4 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-500 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
            >
              Delete account
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleDeleteAccount(e)} className="mt-4 space-y-3">
            <p className="text-sm leading-6 text-[var(--muted)]">Enter your password to confirm. This will permanently erase your account and all data.</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your current password"
              required
              className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-red-400"
            />
            {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isDeleting} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {isDeleting ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(null); }} className="rounded-full border border-[var(--border-soft)] bg-white px-4 py-2 text-sm font-medium text-[var(--muted)]">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
