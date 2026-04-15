// Server component — pure CSS animations, no client JS needed

const SCENE_H = "h-56";

function EnvelopeScene() {
  return (
    <div
      className={`relative ${SCENE_H} overflow-hidden rounded-[1.4rem] bg-[var(--ink)]`}
      style={{ perspective: "600px" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_40%_90%,rgba(18,108,100,0.32),transparent)]" />

      {/* 3D tilt wrapper */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: "rotateX(14deg) rotateY(-10deg)", transformStyle: "preserve-3d" }}
      >
        {/* Inbox tray */}
        <div
          className="absolute bottom-7 h-11 w-40 rounded-xl border border-white/10 bg-white/6 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(0,0,0,0.3)]"
          style={{ transform: "translateZ(-8px)" }}
        />

        {/* Envelope — drop in, pause, reset */}
        <div
          className="absolute"
          style={{
            animation: "envelope-drop 0.9s cubic-bezier(0.34,1.4,0.64,1) 0.2s both, envelope-pause 3.8s 1.1s infinite",
            filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.4))",
          }}
        >
          <svg width="60" height="44" viewBox="0 0 60 44" fill="none">
            <rect x="1" y="1" width="58" height="42" rx="7" fill="rgba(18,108,100,0.9)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
            <path d="M1 9l29 18L59 9" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />
            <rect x="19" y="20" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.14)" />
            <rect x="22" y="27" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.09)" />
          </svg>
        </div>
      </div>

      {/* Overlays — flat */}
      <div className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/60">
        8:00 AM
      </div>
      <div className="absolute left-4 top-4 h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(18,108,100,0.8)]" />
    </div>
  );
}

function DocsScene() {
  return (
    <div
      className={`relative ${SCENE_H} rounded-[1.4rem] bg-[var(--surface)]`}
      style={{ perspective: "500px", overflow: "visible" }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[1.4rem] bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(18,108,100,0.08),transparent)]" />

      {/* 3D tilt wrapper */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: "rotateX(-6deg) rotateY(6deg)", transformStyle: "preserve-3d" }}
      >
        {/* Letter card — behind (rendered first, lower z) */}
        <div
          className="absolute z-0 h-36 w-24 origin-bottom-left rounded-xl border border-[var(--border-soft)] bg-white"
          style={{
            animation: "doc-right-fan 4s cubic-bezier(0.34,1.2,0.64,1) 0.5s infinite",
            boxShadow: "0 12px 40px -10px rgba(18,44,41,0.28), 0 4px 12px -4px rgba(18,44,41,0.14)",
          }}
        >
          <div className="h-3 w-full rounded-t-xl bg-amber-500" />
          <div className="mt-3 space-y-1.5 px-3">
            {[90, 70, 95, 55, 75, 60].map((w, i) => (
              <div key={i} className="h-1.5 rounded-full bg-[var(--border-strong)]" style={{ width: `${w}%` }} />
            ))}
          </div>
          <p className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Letter</p>
          <div
            className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-[0_2px_8px_rgba(217,119,6,0.4)]"
            style={{ animation: "check-pop 4s 0.5s infinite" }}
          >
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* CV card — in front (rendered second, z-10) */}
        <div
          className="absolute z-10 h-36 w-24 origin-bottom-right rounded-xl border border-[var(--border-soft)] bg-white"
          style={{
            animation: "doc-left-fan 4s cubic-bezier(0.34,1.2,0.64,1) 0.5s infinite",
            boxShadow: "0 12px 40px -10px rgba(18,44,41,0.28), 0 4px 12px -4px rgba(18,44,41,0.14)",
          }}
        >
          <div className="h-3 w-full rounded-t-xl bg-[var(--accent)]" />
          <div className="mt-3 space-y-1.5 px-3">
            {[100, 75, 88, 60, 80, 70].map((w, i) => (
              <div key={i} className="h-1.5 rounded-full bg-[var(--border-strong)]" style={{ width: `${w}%` }} />
            ))}
          </div>
          <p className="absolute bottom-2 left-0 right-0 text-center text-[8px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">CV</p>
          <div
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] shadow-[0_2px_8px_rgba(18,108,100,0.5)]"
            style={{ animation: "check-pop 4s 0.5s infinite" }}
          >
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

const trackRows = [
  { company: "BrightPath Studio", role: "Product Designer", delay: "0s" },
  { company: "Hollow Arc", role: "UX Lead", delay: "0.15s" },
  { company: "Meridian Labs", role: "Content Strategist", delay: "0.3s" },
];

const STATUS_LABELS = [
  { label: "Applied", color: "bg-[var(--accent-soft)] text-[var(--accent)]", anim: "status-a" },
  { label: "Interview", color: "bg-amber-50 text-amber-600", anim: "status-b" },
  { label: "Follow-up", color: "bg-blue-50 text-blue-600", anim: "status-c" },
] as const;

function TrackScene() {
  return (
    <div
      className={`relative ${SCENE_H} overflow-hidden rounded-[1.4rem] bg-white`}
      style={{ perspective: "700px" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(18,108,100,0.05),transparent)]" />

      {/* 3D tilt wrapper */}
      <div
        className="absolute inset-0 flex flex-col justify-center gap-2.5 px-4 py-5"
        style={{ transform: "rotateX(10deg) rotateY(-5deg)", transformStyle: "preserve-3d" }}
      >
        {trackRows.map((row) => (
          <div
            key={row.company}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 shadow-[0_4px_12px_-4px_rgba(18,44,41,0.1)]"
            style={{ animation: `row-in 0.5s cubic-bezier(0.16,1,0.3,1) ${row.delay} both` }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--ink)]">{row.company}</p>
              <p className="truncate text-[10px] text-[var(--muted)]">{row.role}</p>
            </div>
            {/* Cycling status badge — fixed width container prevents overflow */}
            <div className="relative h-5 w-[68px] shrink-0">
              {STATUS_LABELS.map(({ label, color, anim }) => (
                <span
                  key={label}
                  className={`absolute inset-0 flex items-center justify-center whitespace-nowrap rounded-full text-[9px] font-semibold ${color}`}
                  style={{ animation: `${anim} 4s 1s infinite` }}
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

const cards = [
  {
    scene: <EnvelopeScene />,
    label: "Daily brief",
    title: "5 roles, 8:00 AM sharp",
    body: "Your top matches land in your inbox every morning. No job board tabs.",
  },
  {
    scene: <DocsScene />,
    label: "Application materials",
    title: "CV & cover letter — tailored",
    body: "A role-specific CV and cover letter are ready in your dashboard within minutes.",
  },
  {
    scene: <TrackScene />,
    label: "Applications",
    title: "Track every application",
    body: "Mark roles applied, set follow-up reminders, and see your pipeline at a glance.",
  },
];

export function FeatureShowcase() {
  return (
    <section className="px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.title}
              className="reveal rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_28px_60px_-42px_rgba(20,43,40,0.2)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
            >
              <div className="rounded-[calc(2rem-0.375rem)] bg-white p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                {card.scene}
                <div className="mt-4 px-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    {card.label}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--ink)]">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{card.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
