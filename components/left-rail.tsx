"use client";

import { useState } from "react";
import {
  CaretLeft,
  CaretRight,
  EnvelopeSimple,
  FileText,
  ClockCounterClockwise,
  ListChecks,
  GearSix,
  SignOut,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { Brand } from "@/components/brand";
import { suggestionExpiry, useHunterAgent } from "./hunteragent-context";

export type WorkspaceView = "brief" | "studio" | "applications";

export function LeftRail({
  view,
  onNavigate,
}: {
  view: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const {
    workspace,
    currentTime,
    draftProfile,
    handleLeftRailToggle,
    handleSetActiveBrief,
    user,
    setIsSettingsOpen,
    handleSignOut,
  } = useHunterAgent();
  const [search, setSearch] = useState("");
  const collapsed = workspace.leftRailCollapsed;
  const items = [
    {
      label: "Your brief",
      icon: EnvelopeSimple,
      view: "brief" as const,
      count:
        workspace.briefs.find((b) => b.id === workspace.activeBriefId)
          ?.topRoleIds.filter((id) => {
            const role = workspace.roleCatalog.find((item) => item.id === id);
            return role && !suggestionExpiry(role, currentTime).expired && !workspace.appliedRecords.some((record) => record.roleId === id);
          }).length ?? 0,
    },
    {
      label: "Application studio",
      icon: FileText,
      view: "studio" as const,
      count: workspace.packs.length,
    },
    {
      label: "Applications",
      icon: ListChecks,
      view: "applications" as const,
      count: workspace.appliedRecords.length,
    },
  ];
  return (
    <aside className={`workspace-rail ${collapsed ? "is-collapsed" : ""}`}>
      <div className="workspace-brand">
        <Brand compact={collapsed} />
        <button
          className="rail-collapse"
          onClick={() => void handleLeftRailToggle()}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <CaretRight size={14} /> : <CaretLeft size={14} />}
        </button>
      </div>
      <nav aria-label="Workspace navigation">
        {items.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            aria-current={view === item.view ? "page" : undefined}
            title={item.label}
            aria-label={item.label}
            disabled={!workspace.onboardingComplete}
          >
            <item.icon
              size={20}
              weight={view === item.view ? "fill" : "regular"}
            />
            <span>{item.label}</span>
            {item.count > 0 && <small>{item.count}</small>}
          </button>
        ))}
      </nav>
      {!collapsed && workspace.onboardingComplete && (
        <div className="rail-schedule">
          <p className="eyebrow">YOUR SCOUT</p>
          <p>
            <span
              className={`signal-dot ${draftProfile.briefsPaused ? "is-paused" : ""}`}
            />{" "}
            {draftProfile.briefsPaused
              ? "Briefs paused"
              : workspace.profile.discoveryCadence === "daily" ? "Searching daily" : "Searching three times a week"}
          </p>
          <small>Daily email window: {workspace.profile.briefTime}. New matches only.</small>
          <small>{draftProfile.timezone.replaceAll("_", " ")}</small>
          <button onClick={() => setIsSettingsOpen(true)}>
            Adjust preferences <CaretRight size={12} />
          </button>
        </div>
      )}
      {!collapsed && workspace.briefs.length > 0 && (
        <details className="rail-history">
          <summary>
            <ClockCounterClockwise size={15} /> Past briefs{" "}
            <span>{workspace.briefs.length}</span>
          </summary>
          <label className="rail-search">
            <MagnifyingGlass size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a date or status"
              aria-label="Search past briefs"
            />
          </label>
          <div className="rail-history-list">
            {workspace.briefs
              .filter((b) =>
                `${b.createdAt} ${b.status}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((b) => (
                <button
                  key={b.id}
                  aria-current={
                    b.id === workspace.activeBriefId ? "true" : undefined
                  }
                  onClick={() => {
                    void handleSetActiveBrief(b.id);
                    onNavigate("brief");
                  }}
                >
                  <span>
                    {new Date(b.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <small>{b.status}</small>
                </button>
              ))}
          </div>
        </details>
      )}
      <div className="rail-account">
        <button
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          <GearSix size={20} />
          <span>Settings</span>
        </button>
        <button
          onClick={() => void handleSignOut()}
          aria-label="Sign out"
          title="Sign out"
        >
          <SignOut size={20} />
          <span>Sign out</span>
        </button>
        <div className="rail-user" title={user.fullName}>
          <span>
            {(user.fullName || "You")
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          {!collapsed && (
            <div>
              <strong>{user.fullName}</strong>
              <small>Your personal workspace</small>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
