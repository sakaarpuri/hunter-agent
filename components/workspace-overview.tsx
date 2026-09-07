"use client";

import { useState } from "react";
import {
  ArrowRight,
  CaretDown,
  Check,
  Clock,
  EnvelopeSimple,
  FileText,
  MapPin,
  SlidersHorizontal,
  Sparkle,
} from "@phosphor-icons/react";
import { suggestionExpiry, useHunterAgent } from "./hunteragent-context";
import { getRoleFromCatalog } from "@/lib/hunteragent-data";
import type { WorkspaceView } from "./left-rail";
import styles from "./account-flow.module.css";

export function WorkspaceOverview({
  onNavigate,
}: {
  onNavigate: (view: WorkspaceView) => void;
}) {
  const {
    workspace,
    isDesignPreview,
    currentTime,
    draftProfile,
    activeBrief,
    replyInput,
    setReplyInput,
    isSubmittingReply,
    isGenerating,
    handleInboundReplySubmit,
    handleSendFirstBriefNow,
    setIsSettingsOpen,
    handleActiveRole,
    handleRoleFeedback,
  } = useHunterAgent();
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<number[]>(() => activeBrief?.selectedRoleIds ?? []);
  const [showMore, setShowMore] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState<number | null>(null);
  const busy = isGenerating || isSubmittingReply;
  const retainedRoles = (activeBrief?.roleIds ?? [])
    .map((id) => getRoleFromCatalog(id, workspace.roleCatalog))
    .filter((role) => role !== null);
  const allRoles = retainedRoles.filter((role) => !suggestionExpiry(role, currentTime).expired &&
    !workspace.appliedRecords.some((record) => record.roleId === role.id));
  const expiredRoles = retainedRoles.filter((role) => suggestionExpiry(role, currentTime).expired);
  const validSelected = selected.filter((id) => allRoles.some((role) => role.id === id));
  const topRoles = allRoles.filter((r) =>
    activeBrief?.topRoleIds.includes(r.id),
  );
  const displayRoles = showMore ? allRoles : topRoles;
  function toggle(roleId: number) {
    const next = selected.includes(roleId)
      ? validSelected.filter((id) => id !== roleId)
      : [...validSelected, roleId];
    setSelected(next);
    setReplyInput(
      next
        .map((id) => ((activeBrief?.replyRoleIds ?? activeBrief?.roleIds)?.indexOf(id) ?? -1) + 1)
        .sort((a, b) => a - b)
        .join(", "),
    );
  }

  if (workspace.flowPhase === "waiting" || !activeBrief) {
    return (
      <section className="waiting-layout">
        <div className="waiting-card">
          <div className="waiting-icon">
            <EnvelopeSimple size={34} weight="duotone" />
          </div>
          <p className="eyebrow">
            {draftProfile.briefsPaused
              ? "TAKE YOUR TIME"
              : "YOUR SCOUT IS SET UP"}
          </p>
          <h2>
            {draftProfile.briefsPaused
              ? "Your search can wait."
              : "Your next chapter\nstarts with a brief."}
          </h2>
          <p>
            {draftProfile.briefsPaused
              ? "Your brief emails are paused. Resume in preferences whenever you're ready."
              : `Our agents search ${workspace.profile.discoveryCadence === "daily" ? "daily" : "three times a week"} for up to 3 new matches per brief. Your email window is ${workspace.profile.briefTime} in ${workspace.profile.timezone.replaceAll("_", " ")}. No genuine new matches means no email, never padding.`}
          </p>
          <div className="waiting-actions">
            <button
              className="button button-accent"
              disabled={sending || draftProfile.briefsPaused}
              onClick={async () => {
                setSending(true);
                try {
                  await handleSendFirstBriefNow();
                } finally {
                  setSending(false);
                }
              }}
            >
              {sending ? "Finding your roles..." : "Find my first roles now"}
              <ArrowRight size={17} />
            </button>
            <button
              className="text-link"
              onClick={() => setIsSettingsOpen(true)}
            >
              <SlidersHorizontal size={16} />
              Adjust delivery
            </button>
          </div>
          <p className="waiting-footnote" aria-live="polite">
            {sending
              ? "Searching and preparing your email. Keep this page open."
              : "You can choose roles from your inbox or right here."}
          </p>
          <p className={styles.lifecycleNote}>Suggestions expire seven days after first discovery, including selected jobs. Applied history and generated documents remain in Applications and the studio.</p>
        </div>
        <aside className="next-step-notes">
          <p className="eyebrow">WHAT HAPPENS NEXT</p>
          {[
            [
              "01",
              "A considered shortlist",
              "Your preferences guide the search. Each role comes with a reason to look closer.",
            ],
            [
              "02",
              "A simple decision",
              "Reply to your email with job numbers or select the roles you want here.",
            ],
            [
              "03",
              "An application with direction",
              "Choose Prepare my materials when you want AI help. Selecting alone does not generate anything.",
            ],
          ].map(([n, h, p]) => (
            <div key={n}>
              <span>{n}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </aside>
      </section>
    );
  }

  return (
    <section className="brief-workspace">
      <div className="brief-summary">
        <div>
          <p className="eyebrow">
            CURATED FOR{" "}
            {draftProfile.name.split(" ")[0]?.toUpperCase() || "YOU"}
          </p>
          <h2>{topRoles.length} roles worth a closer look.</h2>
          <p>
            {draftProfile.materialsMode === "self"
              ? "Select your favourites to review and track your next move."
              : "Select your favourites, then choose Prepare my materials when you want AI help."}
          </p>
        </div>
        <button
          className="button button-quiet button-small"
          onClick={() => setIsSettingsOpen(true)}
        >
          <SlidersHorizontal size={16} />
          Tune your search
        </button>
      </div>
      <p className={styles.lifecycleNote}>
        Suggested jobs stay for seven days from first discovery, including selected jobs. This is not the employer&apos;s application deadline. Applied history and generated documents are kept separately.
        {" "}Up to 3 genuine new matches per brief, never padding.
      </p>
      <div className="brief-filter-line">
        <span>
          <EnvelopeSimple size={14} />
          {activeBrief.sentAt ? "Delivered to your inbox" : "Brief prepared"}
        </span>
        <span>
          {draftProfile.workplaceModes.join(" / ") || "All work styles"}
        </span>
        <span>{draftProfile.locations || "Your preferred locations"}</span>
      </div>
      {displayRoles.length === 0 && (
        <div className="workspace-empty">
          <h3>No current suggestions in this brief.</h3>
          <p>
            Suggestions may have expired or moved to applied history. We only send genuine new matches, so a brief can be smaller than your chosen size. Saved documents remain in the studio.
          </p>
          <button
            className="button button-quiet"
            onClick={() => setIsSettingsOpen(true)}
          >
            Adjust preferences
          </button>
        </div>
      )}
      <div className="real-role-list">
        {displayRoles.map((role) => {
          const position = (activeBrief.replyRoleIds ?? activeBrief.roleIds).indexOf(role.id) + 1;
          const expiry = suggestionExpiry(role, currentTime);
          const pack = workspace.packs.find(
            (p) => p.roleId === role.id && p.briefId === activeBrief.id,
          );
          const applied = workspace.appliedRecords.some(
            (r) => r.roleId === role.id,
          );
          const open = expanded === role.id;
          const feedback = workspace.roleFeedback[String(role.id)];
          return (
            <article
              className={`real-role ${selected.includes(role.id) ? "is-selected" : ""}`}
              key={role.id}
            >
              <div className="role-main">
                <button
                  className="selection-control"
                  disabled={busy}
                  aria-label={`${selected.includes(role.id) ? "Deselect" : "Select"} ${role.title} at ${role.company}`}
                  aria-pressed={selected.includes(role.id)}
                  onClick={() => toggle(role.id)}
                >
                  {selected.includes(role.id) && (
                    <Check size={14} weight="bold" />
                  )}
                </button>
                <span className="role-position">
                  {String(position).padStart(2, "0")}
                </span>
                <div className="role-title">
                  <p>{role.company}</p>
                  <h3>{role.title}</h3>
                  <div className="role-meta">
                    <span>
                      <MapPin size={12} />
                      {role.location}
                    </span>
                    <span>{role.employment}</span>
                    <span>{role.posted}</span>
                    <time className={styles.expiryStatus} dateTime={expiry.expires ?? undefined}>
                      <Clock size={12} /> {expiry.label}
                    </time>
                  </div>
                </div>
                <span className={`role-badge ${applied ? "is-applied" : ""}`}>
                  {applied
                    ? "Applied"
                    : pack
                      ? "Materials ready"
                      : role.explorationKind === "adjacent"
                        ? "A little stretch"
                        : "Close match"}
                </span>
              </div>
              <div className="role-reason">
                <Sparkle size={15} />
                <p>
                  <strong>Why this role</strong>
                  {role.fit}
                </p>
              </div>
              <div className="role-actions">
                {role.sourceUrl?.startsWith("https://") && (
                  <a className="text-link" href={role.sourceUrl} target="_blank" rel="noopener noreferrer"
                    onClick={() => { if (!isDesignPreview) void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "role_opened", roleId: role.id }) }).catch(() => {}); }}>
                    Original listing <ArrowRight size={14} />
                  </a>
                )}
                <button
                  className="text-link"
                  aria-expanded={open}
                  aria-controls={`role-detail-${role.id}`}
                  onClick={() => setExpanded(open ? null : role.id)}
                >
                  {open ? "Less detail" : "Role details"}
                  <CaretDown
                    size={13}
                    style={{ transform: open ? "rotate(180deg)" : undefined }}
                  />
                </button>
                {pack && (
                  <button
                    className="text-link"
                    onClick={async () => {
                      await handleActiveRole(role.id);
                      onNavigate("studio");
                    }}
                  >
                    Open materials <ArrowRight size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)] px-5 py-3 text-sm">
                <span className="mr-1 text-[var(--muted)]">Help your next brief:</span>
                <button type="button" className={`rounded-full border px-3 py-1.5 font-medium ${feedback?.reaction === "interested" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-soft)] bg-white text-[var(--ink)]"}`}
                  onClick={() => { setFeedbackOpen(null); void handleRoleFeedback(role.id, "interested"); }}>
                  Worth a look
                </button>
                <button type="button" className={`rounded-full border px-3 py-1.5 font-medium ${feedback?.reaction === "not_for_me" ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--border-soft)] bg-white text-[var(--ink)]"}`}
                  onClick={() => setFeedbackOpen(feedbackOpen === role.id ? null : role.id)}>
                  Not for me
                </button>
                <span className="ml-auto text-xs text-[var(--muted)]">
                  {role.sourceVerificationStatus === "verified" ? "Listing checked today" : "Check current availability"}
                </span>
              </div>
              {feedbackOpen === role.id && (
                <div className="flex flex-wrap gap-2 bg-[var(--surface)] px-5 pb-4 text-xs" aria-label="Why this role is not for you">
                  {([
                    ["salary", "Pay"], ["location", "Location"], ["company", "Company"],
                    ["seniority", "Level"], ["direction", "Wrong direction"], ["not_exciting", "Not exciting"],
                  ] as const).map(([reason, label]) => (
                    <button key={reason} type="button" className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-[var(--ink)]"
                      onClick={() => { setFeedbackOpen(null); void handleRoleFeedback(role.id, "not_for_me", reason); }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {open && (
                <div id={`role-detail-${role.id}`} className="role-detail">
                  <p>{role.summary}</p>
                  <div>
                    {role.focus.map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {expiredRoles.length > 0 && (
        <details className="brief-activity">
          <summary>Expired suggestions ({expiredRoles.length})</summary>
          {expiredRoles.map((role) => (
            <p key={role.id} className={styles.expiredRole}>
              {role.company}: {role.title}. {suggestionExpiry(role, currentTime).label}. Selection does not extend the seven-day window.
            </p>
          ))}
        </details>
      )}
      {allRoles.length > topRoles.length && (
        <button className="more-roles" onClick={() => setShowMore(!showMore)}>
          {showMore
            ? "Show priority roles only"
            : `Explore ${allRoles.length - topRoles.length} more opportunities`}
          <CaretDown size={15} />
        </button>
      )}
      <div className="selection-dock">
        <div aria-live="polite">
          <strong>
            {validSelected.length
              ? `${validSelected.length} ${validSelected.length === 1 ? "role" : "roles"} selected`
              : "Your next move starts with a pick."}
          </strong>
          <span>
            {busy
              ? "Preparing your materials. This may take a few minutes."
              : selected.length !== validSelected.length
                ? "A selected suggestion expired. Choose from the current roles."
                : "Selecting does not start AI writing or extend the seven-day expiry."}
          </span>
        </div>
        {draftProfile.materialsMode !== "self" && (
          <button className="button button-quiet"
            disabled={busy || !validSelected.length || validSelected.length !== selected.length}
            onClick={() => void handleInboundReplySubmit()}>
            Save selected roles
          </button>
        )}
        <button
          className="button button-accent"
          disabled={busy || !allRoles.length || (selected.length > 0 ? validSelected.length !== selected.length : !replyInput.trim())}
          onClick={async () => {
            await handleInboundReplySubmit({ prepareMaterials: true });
          }}
        >
          {busy
            ? "Preparing materials..."
            : draftProfile.materialsMode === "self"
              ? "Review selected roles"
              : "Prepare my materials"}
          <ArrowRight size={16} />
        </button>
      </div>
      <details
        className="reply-alternative"
        open={showReply}
        onToggle={(e) => setShowReply(e.currentTarget.open)}
      >
        <summary>Prefer to type a reply?</summary>
        <label htmlFor="brief-reply">
          Use the numbers shown above, for example 1 and 3.
        </label>
        <textarea
          id="brief-reply"
          value={replyInput}
          onChange={(e) => {
            setSelected([]);
            setReplyInput(e.target.value);
          }}
          rows={2}
          placeholder="1 and 3, please"
          disabled={busy}
        />
      </details>
      {activeBrief.inboundRecords.length > 0 && (
        <details className="brief-activity">
          <summary>
            Brief activity{" "}
            <span>{activeBrief.inboundRecords.length} replies</span>
          </summary>
          {activeBrief.inboundRecords.map((record) => (
            <div key={record.id}>
              <Clock size={14} />
              <p>
                <strong>{record.normalizedReply}</strong>
                <small>
                  {new Date(record.receivedAt).toLocaleString("en-GB")} ·{" "}
                  {record.source === "webhook" ? "Email" : "Dashboard"}
                </small>
              </p>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

export function ApplicationsView({
  onNavigate,
}: {
  onNavigate: (view: WorkspaceView) => void;
}) {
  const {
    appliedDetails,
    handleFollowUpPlan,
    handleActiveRole,
    handleSetActiveBrief,
  } = useHunterAgent();
  const [updating, setUpdating] = useState<number | null>(null);
  return (
    <section className="applications-view">
      <div className="brief-summary">
        <div>
          <p className="eyebrow">KEEP YOUR MOMENTUM</p>
          <h2>Every application. A next step.</h2>
          <p>
            {appliedDetails.length}{" "}
            {appliedDetails.length === 1 ? "application" : "applications"}{" "}
            recorded. Follow up on your terms.
          </p>
        </div>
      </div>
      {!appliedDetails.length ? (
        <div className="workspace-empty">
          <FileText size={35} />
          <h3>Your next chapter starts here.</h3>
          <p>
            Once you&apos;ve applied to a role, mark it applied in the studio.
            It will appear here with your optional follow-up plan.
          </p>
          <button
            className="button button-dark"
            onClick={() => onNavigate("brief")}
          >
            Explore your brief <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        appliedDetails.map((record) => (
          <article
            key={`${record.roleId}:${record.briefId}`}
            className="application-row"
          >
            <div>
              <p className="eyebrow">{record.role.company}</p>
              <h3>{record.role.title}</h3>
              <p className="application-date">
                Applied{" "}
                {new Date(record.appliedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
            <div className="application-followup">
              <label htmlFor={`followup-${record.roleId}-${record.briefId}`}>
                Follow-up plan
              </label>
              <select
                id={`followup-${record.roleId}-${record.briefId}`}
                disabled={updating === record.roleId}
                value={record.followUp}
                onChange={async (e) => {
                  setUpdating(record.roleId);
                  try {
                    await handleFollowUpPlan(
                      record.roleId,
                      e.target.value as "off" | "7" | "14",
                    );
                  } finally {
                    setUpdating(null);
                  }
                }}
              >
                <option value="off">No follow-up</option>
                <option value="7">After 7 days</option>
                <option value="14">After 14 days</option>
              </select>
              {record.followUpDueAt && (
                <small>
                  Due{" "}
                  {new Date(record.followUpDueAt).toLocaleDateString("en-GB")}
                </small>
              )}
            </div>
            <button
              className="text-link"
              onClick={async () => {
                await handleSetActiveBrief(record.briefId);
                await handleActiveRole(record.roleId);
                onNavigate("studio");
              }}
            >
              Open materials <ArrowRight size={15} />
            </button>
            {record.followUpDraft && (
              <details className="application-draft">
                <summary>Review follow-up draft</summary>
                <p>{record.followUpDraft}</p>
              </details>
            )}
          </article>
        ))
      )}
    </section>
  );
}
