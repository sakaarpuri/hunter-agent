"use client";

import { useState } from "react";
import {
  ArrowClockwise,
  CalendarDots,
  CaretLeft,
  CaretRight,
  EnvelopeSimple,
  Folders,
  GlobeHemisphereWest,
  ListChecks,
  MagnifyingGlass,
  Palette,
  PencilSimple,
  SignOut,
  Sparkle,
  Target,
  UserCircle,
} from "@phosphor-icons/react";
import { getResumeStyle, formatClock } from "@/lib/hunteragent-data";
import { useHunterAgent } from "./hunteragent-context";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type NavItem = {
  label: string;
  icon: typeof ListChecks;
  active: boolean;
  action?: () => void;
};

const BRIEF_PAGE_SIZE = 8;

export function LeftRail() {
  const {
    workspace,
    draftProfile,
    isSavingDraft,
    handleReset,
    handleLeftRailToggle,
    handleSetActiveBrief,
    user,
    setIsSettingsOpen,
    handleSignOut,
  } = useHunterAgent();

  const [briefSearch, setBriefSearch] = useState("");
  const [briefPage, setBriefPage] = useState(1);
  const [showBriefs, setShowBriefs] = useState(false);

  const navItems: NavItem[] = [
    { label: "Setup", icon: ListChecks, active: workspace.flowPhase === "onboarding" },
    { label: "Today", icon: EnvelopeSimple, active: ["waiting", "brief", "processing"].includes(workspace.flowPhase) },
    { label: "Studio", icon: Sparkle, active: workspace.flowPhase === "studio" },
    { label: "Applied", icon: Folders, active: (workspace.appliedRecords.length ?? 0) > 0 },
    { label: "Follow Up", icon: CalendarDots, active: (workspace.appliedRecords.some((item) => item.followUp !== "off") ?? false) },
    { label: "Reset", icon: ArrowClockwise, active: false, action: handleReset },
  ];

  return (
    <aside className={cn("hidden border-b border-[var(--border-soft)] bg-[var(--surface)] py-6 lg:block lg:border-r lg:border-b-0", workspace.leftRailCollapsed ? "px-3" : "px-5")}>
      <div className={cn("flex items-center", workspace.leftRailCollapsed ? "justify-center" : "justify-between")}>
        {!workspace.leftRailCollapsed && (
          <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            HunterAgent
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
            Daily brief at {draftProfile.briefTime}
          </h2>
          </div>
        )}
        <div className="flex items-center gap-2">
<button
            type="button"
            onClick={() => void handleLeftRailToggle()}
            className="rounded-full border border-[var(--border-soft)] bg-white p-2 text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
            aria-label={workspace.leftRailCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
            title={workspace.leftRailCollapsed ? "Expand navigation rail" : "Collapse navigation rail"}
          >
            {workspace.leftRailCollapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
          </button>
        </div>
      </div>

      <nav className={cn("grid gap-2 text-sm", workspace.leftRailCollapsed ? "mt-6" : "mt-8")}>
        {navItems.map(({ label, icon: Icon, active, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className={cn(
              "flex items-center rounded-2xl py-3 text-left transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]",
              workspace.leftRailCollapsed ? "justify-center px-0" : "gap-3 px-3",
              active ? "bg-[var(--accent)] text-white shadow-[0_20px_50px_-34px_rgba(18,108,100,0.9)]" : "text-[var(--muted)] hover:bg-white",
            )}
            title={workspace.leftRailCollapsed ? label : undefined}
          >
            <Icon size={18} weight={active ? "fill" : "duotone"} />
            {!workspace.leftRailCollapsed && <span className="font-medium">{label}</span>}
          </button>
        ))}
      </nav>

      {!workspace.leftRailCollapsed && workspace.briefs.length > 1 && (() => {
        const filtered = workspace.briefs
          .filter((b) => {
            if (!briefSearch.trim()) return true;
            const q = briefSearch.toLowerCase();
            const date = b.scheduledFor ?? b.createdAt;
            return date.toLowerCase().includes(q) || b.status.includes(q);
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const paged = filtered.slice(0, briefPage * BRIEF_PAGE_SIZE);
        return (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowBriefs((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Past briefs
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[0.65rem] font-bold">{workspace.briefs.length}</span>
            </button>
            {showBriefs && (
              <div className="mt-3">
                <div className="relative">
                  <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    value={briefSearch}
                    onChange={(e) => { setBriefSearch(e.target.value); setBriefPage(1); }}
                    placeholder="Search briefs…"
                    className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] py-2 pl-8 pr-3 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="mt-2 space-y-1">
                  {paged.map((brief) => (
                    <button
                      key={brief.id}
                      type="button"
                      onClick={() => void handleSetActiveBrief(brief.id)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2 text-left text-xs transition-colors",
                        brief.id === workspace.activeBriefId
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--muted)] hover:bg-white hover:text-[var(--ink)]",
                      )}
                    >
                      <span className="block font-medium">
                        {brief.scheduledFor
                          ? new Date(brief.scheduledFor).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                          : new Date(brief.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      <span className={cn("block capitalize", brief.id === workspace.activeBriefId ? "text-white/70" : "text-[var(--muted)]")}>
                        {brief.status}
                        {brief.selectedRoleIds.length > 0 && ` · ${brief.selectedRoleIds.length} selected`}
                      </span>
                    </button>
                  ))}
                  {paged.length < filtered.length && (
                    <button
                      type="button"
                      onClick={() => setBriefPage((p) => p + 1)}
                      className="w-full rounded-xl px-3 py-2 text-center text-xs text-[var(--accent)] hover:underline"
                    >
                      Load more ({filtered.length - paged.length} remaining)
                    </button>
                  )}
                  {filtered.length === 0 && (
                    <p className="px-3 py-2 text-xs text-[var(--muted)]">No briefs match.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {!workspace.leftRailCollapsed && <div className="mt-6 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
          Delivery
        </p>
        <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
          <div className="flex items-center justify-between gap-3">
            <span>Timezone</span>
            <span className="font-mono text-[var(--ink)]">{draftProfile.timezone}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Brief time</span>
            <span className="font-mono text-[var(--ink)]">{draftProfile.briefTime}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>First brief</span>
            <span className="text-[var(--ink)]">{draftProfile.firstBrief === "now" ? "Send now" : "Scheduled"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Recipient</span>
            <span className="text-[var(--ink)]">{draftProfile.recipientEmail || "Not set"}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Draft autosave</span>
            <span className={cn("font-medium", isSavingDraft ? "text-[var(--accent)]" : "text-[var(--muted)]")}>
              {isSavingDraft ? "Saving" : "Live"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Brief status</span>
            <span className={cn("font-medium", draftProfile.briefsPaused ? "text-amber-600" : "text-[var(--accent)]")}>
              {draftProfile.briefsPaused ? "Paused" : "Active"}
            </span>
          </div>
        </div>
      </div>}

      {!workspace.leftRailCollapsed && <div className="mt-6 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
          Your profile
        </p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
          <div className="flex items-start gap-3">
            <UserCircle size={18} className="mt-1 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-[var(--ink)]">{draftProfile.name}</p>
              <p>{draftProfile.currentTitle}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Target size={18} className="mt-1 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-[var(--ink)]">Target roles</p>
              <p>{draftProfile.targetRoles.filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <GlobeHemisphereWest size={18} className="mt-1 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-[var(--ink)]">Locations</p>
              <p>{draftProfile.locations}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Palette size={18} className="mt-1 text-[var(--accent)]" />
            <div>
              <p className="font-medium text-[var(--ink)]">Default style</p>
              <p>{getResumeStyle(draftProfile.resumeDefaultStyle).label}</p>
            </div>
          </div>
        </div>
      </div>}

      {!workspace.leftRailCollapsed && workspace.appliedRecords.length > 0 && (
        <div className="mt-6 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Applications</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Applied</span>
              <span className="font-semibold text-[var(--ink)]">{workspace.appliedRecords.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">With follow-up</span>
              <span className="font-semibold text-[var(--ink)]">
                {workspace.appliedRecords.filter((r) => r.followUp && r.followUp !== "off").length}
              </span>
            </div>
            {workspace.appliedRecords.length > 0 && (
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{
                    width: `${Math.min(100, (workspace.appliedRecords.filter((r) => r.followUp && r.followUp !== "off").length / workspace.appliedRecords.length) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <div className={cn("mt-6 border-t border-[var(--border-soft)] pt-4", workspace.leftRailCollapsed ? "flex flex-col items-center gap-2" : "space-y-1")}>
        {!workspace.leftRailCollapsed && (
          <p className="mb-2 truncate text-xs text-[var(--muted)]">{user.fullName}</p>
        )}
        <button
          type="button"
          onClick={() => setIsSettingsOpen((current) => !current)}
          className={cn(
            "flex items-center rounded-2xl py-3 text-left text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white active:translate-y-[1px] active:scale-[0.98]",
            workspace.leftRailCollapsed ? "justify-center px-0 w-full" : "gap-3 px-3 w-full",
          )}
          title={workspace.leftRailCollapsed ? "Settings" : undefined}
        >
          <PencilSimple size={18} weight="duotone" />
          {!workspace.leftRailCollapsed && <span className="font-medium">Settings</span>}
        </button>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className={cn(
            "flex items-center rounded-2xl py-3 text-left text-[var(--muted)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-white active:translate-y-[1px] active:scale-[0.98]",
            workspace.leftRailCollapsed ? "justify-center px-0 w-full" : "gap-3 px-3 w-full",
          )}
          title={workspace.leftRailCollapsed ? "Sign out" : undefined}
        >
          <SignOut size={18} weight="duotone" />
          {!workspace.leftRailCollapsed && <span className="font-medium">Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
