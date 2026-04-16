"use client";

import { useState, useEffect } from "react";

const SCENE_H = "h-[19rem]";

// Teal core fading to cyan at the outer edge — brand-anchored gradient side face
const SHADOW_3D =
  "7px 2px 0 rgba(18,108,100,0.95), 13px 3px 0 rgba(10,148,128,0.65), 17px 4px 0 rgba(6,182,212,0.32)";

// rotateX(-2deg): near-flat backward lean — removes top/bottom width distortion
// rotateY(-16deg): right face visible (viewer slightly to the right)
const TILT = "perspective(560px) rotateX(-1deg) rotateY(-6deg)";

// Build the stacked / entry transform for each card index.
function entryTransform(index: number) {
  if (index === 0) return TILT;
  return `perspective(560px) translateX(calc(-${index * 100}% - ${index * 20}px)) rotateX(-1deg) rotateY(-6deg)`;
}

// ─── Typing text ───────────────────────────────────────────────────────────────

function TypingText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let charTimer: ReturnType<typeof setTimeout>;
    const startTimer = setTimeout(() => {
      let i = 0;
      const tick = () => {
        i++;
        setShown(text.slice(0, i));
        if (i < text.length) {
          charTimer = setTimeout(tick, 22);
        } else {
          setDone(true);
        }
      };
      tick();
    }, delay);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(charTimer!);
    };
  }, [text, delay]);

  return (
    <p className="mt-1.5 min-h-[3.8rem] text-xs leading-5 text-[var(--muted)]">
      {shown || <span className="opacity-0">{text}</span>}
      {!done && shown.length > 0 && (
        <span
          className="ml-px text-[var(--accent)]"
          style={{ animation: "cursor-blink 0.65s step-end infinite" }}
        >
          |
        </span>
      )}
    </p>
  );
}

// ─── Scenes ────────────────────────────────────────────────────────────────────

// Varying widths per row so skeleton lines look like real varied content
const LISTING_WIDTHS: [number, number][] = [
  [62, 38],
  [74, 44],
  [55, 30],
  [68, 40],
  [58, 35],
];

function EnvelopeScene() {
  return (
    <div className={`relative ${SCENE_H} overflow-hidden rounded-[1.4rem] bg-[var(--ink)]`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_38%_85%,rgba(18,108,100,0.35),transparent)]" />

      {/* Envelope — drops from top, bounces, holds, fades, repeats */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: 38,
          marginLeft: -30,
          animation: "env-cycle-v2 5.5s ease-out 0.3s infinite",
        }}
      >
        <div
          style={{
            width: 60,
            height: 45,
            borderRadius: 7,
            background: "rgba(18,108,100,0.92)",
            border: "1px solid rgba(255,255,255,0.16)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <svg width="60" height="45" viewBox="0 0 60 45" style={{ position: "absolute", inset: 0 }} fill="none">
            <path d="M1 8L30 26L59 8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          </svg>
          <div style={{ position: "absolute", bottom: 14, left: 10, width: 24, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
          <div style={{ position: "absolute", bottom: 8, left: 10, width: 16, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
        </div>
      </div>

      {/* 5 skeleton listing rows — staggered appearance after envelope lands */}
      {/* top:96 = ~13px below the envelope (top:38 + height:45) */}
      <div className="absolute inset-x-3 flex flex-col gap-[4px]" style={{ top: 96 }}>
        {LISTING_WIDTHS.map(([titleW, companyW], i) => (
          <div
            key={i}
            style={{
              height: 22,
              borderRadius: 6,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "0 8px",
              opacity: 0,
              animation: `listing-row-appear 5.5s ease-out ${0.3 + i * 0.18}s infinite`,
            }}
          >
            {/* Bullet */}
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(18,108,100,0.85)", flexShrink: 0 }} />
            {/* Title skeleton */}
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", width: `${titleW}%` }} />
            {/* Company skeleton */}
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)", width: `${companyW}%` }} />
          </div>
        ))}
      </div>

      <div className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/60">
        8:00 AM
      </div>
      <div className="absolute left-4 top-4 h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(18,108,100,0.9)]" />
    </div>
  );
}

function DocsScene() {
  return (
    <div
      className={`relative ${SCENE_H} overflow-hidden rounded-[1.4rem]`}
      style={{
        background: "var(--surface)",
        backgroundImage: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(18,108,100,0.07), transparent)",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Letter — behind */}
        <div
          style={{
            position: "absolute",
            width: 96,
            height: 136,
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            border: "1px solid rgba(24,44,41,0.09)",
            zIndex: 0,
            animation: "doc-right-fan 4s cubic-bezier(0.34,1.2,0.64,1) 0.5s infinite",
            transformOrigin: "50% 100%",
          }}
        >
          <div style={{ height: 11, background: "#f59e0b", borderRadius: "12px 12px 0 0" }} />
          <div style={{ padding: "10px 10px 0" }}>
            {[90, 68, 96, 52, 78, 62].map((w, i) => (
              <div key={i} style={{ height: 5, borderRadius: 3, background: "rgba(24,44,41,0.13)", width: `${w}%`, marginBottom: 6 }} />
            ))}
          </div>
          <p style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(96,115,109,0.7)" }}>
            Letter
          </p>
          <div style={{ position: "absolute", top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(217,119,6,0.4)", animation: "check-pop 4s 0.5s infinite" }}>
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* CV — in front */}
        <div
          style={{
            position: "absolute",
            width: 96,
            height: 136,
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            border: "1px solid rgba(24,44,41,0.09)",
            zIndex: 10,
            animation: "doc-left-fan 4s cubic-bezier(0.34,1.2,0.64,1) 0.5s infinite",
            transformOrigin: "50% 100%",
          }}
        >
          <div style={{ height: 11, background: "#126c64", borderRadius: "12px 12px 0 0" }} />
          <div style={{ padding: "10px 10px 0" }}>
            {[100, 75, 88, 60, 82, 70].map((w, i) => (
              <div key={i} style={{ height: 5, borderRadius: 3, background: "rgba(24,44,41,0.13)", width: `${w}%`, marginBottom: 6 }} />
            ))}
          </div>
          <p style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(96,115,109,0.7)" }}>
            CV
          </p>
          <div style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "#126c64", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(18,108,100,0.5)", animation: "check-pop 4s 0.5s infinite" }}>
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

const trackRows = [
  { company: "BrightPath Studio", role: "Product Designer", delay: "0s" },
  { company: "Hollow Arc", role: "UX Lead", delay: "0.12s" },
  { company: "Meridian Labs", role: "Content Strategist", delay: "0.24s" },
  { company: "Riverframe", role: "Growth Marketer", delay: "0.36s" },
];

const STATUS_LABELS = [
  { label: "Applied", color: "rgba(18,108,100,0.12)", text: "#126c64", anim: "status-a" },
  { label: "Interview", color: "rgba(245,158,11,0.12)", text: "#d97706", anim: "status-b" },
  { label: "Follow-up", color: "rgba(59,130,246,0.12)", text: "#2563eb", anim: "status-c" },
] as const;

function TrackScene() {
  return (
    <div
      className={`relative ${SCENE_H} overflow-hidden rounded-[1.4rem] bg-[var(--surface)]`}
      style={{
        backgroundImage: "radial-gradient(ellipse 55% 38% at 50% 100%, rgba(18,108,100,0.06), transparent)",
      }}
    >
      {/* Header */}
      <div className="absolute left-4 right-4 top-3.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
          Pipeline
        </span>
        <span className="text-[10px] font-medium text-[var(--accent)]">4 active</span>
      </div>

      {/* Rows */}
      <div className="absolute inset-x-3 top-10 flex flex-col gap-[7px]">
        {trackRows.map((row) => (
          <div
            key={row.company}
            style={{
              height: 44,
              borderRadius: 10,
              border: "1px solid rgba(24,44,41,0.08)",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              gap: 8,
              animation: `row-in 0.5s cubic-bezier(0.16,1,0.3,1) ${row.delay} both`,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#182c29", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.company}
              </p>
              <p style={{ fontSize: 10, color: "#60736d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.role}
              </p>
            </div>
            <div style={{ position: "relative", width: 64, height: 20, flexShrink: 0 }}>
              {STATUS_LABELS.map(({ label, color, text, anim }) => (
                <span
                  key={label}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    background: color,
                    color: text,
                    fontSize: 9,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    animation: `${anim} 4s 1s infinite`,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cards data ────────────────────────────────────────────────────────────────

const cards = [
  {
    scene: <EnvelopeScene />,
    label: "Daily brief",
    title: "5 roles, 8:00 AM sharp",
    body: "Your top matches land in your inbox every morning. No job board tabs.",
    typingDelay: 500,
  },
  {
    scene: <DocsScene />,
    label: "Application materials",
    title: "CV & cover letter — tailored",
    body: "A role-specific CV and cover letter are ready in your dashboard within minutes.",
    typingDelay: 1100,
  },
  {
    scene: <TrackScene />,
    label: "Applications",
    title: "Track every application",
    body: "Mark roles applied, set follow-up reminders, and see your pipeline at a glance.",
    typingDelay: 1500,
  },
];

// ─── Inline card grid (no section wrapper — embeds in hero right col) ──────────

export function FeatureCards() {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) { setEntered(true); return; }
    const t = setTimeout(() => setEntered(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Each card after the first overlaps the previous by 4px
  const OVERLAP = 4;

  return (
    <div className="flex">
      {cards.map((card, index) => (
        <article
          key={card.title}
          style={{
            transform: entered ? TILT : entryTransform(index),
            boxShadow: SHADOW_3D,
            zIndex: cards.length - index,
            position: "relative",
            flex: "1 1 0",
            minWidth: 0,
            marginLeft: index > 0 ? -OVERLAP : 0,
            transition: entered
              ? `transform 0.78s cubic-bezier(0.16, 1, 0.3, 1) ${index * 280}ms`
              : "none",
          }}
          className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-0.5"
        >
          <div className="rounded-[calc(1.4rem-0.125rem)] bg-white p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
            {card.scene}
            <div className="mt-3 px-1.5 pb-2">
              <p className="truncate text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                {card.label}
              </p>
              <h3 className="mt-1 text-[0.76rem] font-semibold leading-[1.3] tracking-tight text-[var(--ink)]">
                {card.title}
              </h3>
              <p className="mt-1.5 text-[0.65rem] leading-[1.55] text-[var(--muted)]">
                {card.body}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function FeatureShowcase() {
  // Once `entered` flips true each card transitions to its final TILT position.
  // Card 0 starts at final position; cards 1 & 2 start stacked behind card 0.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // On mobile (single-column grid) skip the slide animation entirely
    if (window.innerWidth < 768) {
      setEntered(true);
      return;
    }
    // Short pause so the user sees card 0 before the others slide out
    const t = setTimeout(() => setEntered(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="px-4 pb-6 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[960px]">
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card, index) => (
            <article
              key={card.title}
              style={{
                transform: entered ? TILT : entryTransform(index),
                boxShadow: SHADOW_3D,
                // Card 0 sits on top so 1 & 2 slide from beneath it
                zIndex: cards.length - index,
                position: "relative",
                transition: entered
                  ? `transform 0.78s cubic-bezier(0.16, 1, 0.3, 1) ${index * 280}ms`
                  : "none",
              }}
              className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1"
            >
              <div className="rounded-[calc(1.75rem-0.25rem)] bg-white p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                {card.scene}
                <div className="mt-3 px-1">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    {card.label}
                  </p>
                  <h3 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--ink)]">
                    {card.title}
                  </h3>
                  <TypingText text={card.body} delay={card.typingDelay} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
