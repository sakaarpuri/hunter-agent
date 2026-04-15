// Server component — pure CSS animations, no client JS needed

function EnvelopeScene() {
  return (
    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-[1.4rem] bg-[var(--ink)]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_80%,rgba(18,108,100,0.28),transparent)]" />

      {/* Inbox tray */}
      <div className="absolute bottom-8 h-10 w-36 rounded-xl border border-white/10 bg-white/6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" />

      {/* Envelope — drop in, pause, reset */}
      <div
        className="absolute"
        style={{ animation: "envelope-drop 0.9s cubic-bezier(0.34,1.4,0.64,1) 0.2s both, envelope-pause 3.8s 1.1s infinite" }}
      >
        <svg width="52" height="38" viewBox="0 0 52 38" fill="none">
          <rect x="1" y="1" width="50" height="36" rx="6" fill="rgba(18,108,100,0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <path d="M1 7l25 16L51 7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <rect x="16" y="16" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.15)" />
          <rect x="20" y="22" width="12" height="3" rx="1.5" fill="rgba(255,255,255,0.10)" />
        </svg>
      </div>

      {/* Time badge */}
      <div className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/60">
        8:00 AM
      </div>

      {/* Dot indicator */}
      <div className="absolute left-4 top-4 h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(18,108,100,0.8)]" />
    </div>
  );
}

function DocsScene() {
  return (
    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-[1.4rem] bg-[var(--surface)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_50%_50%,rgba(18,108,100,0.07),transparent)]" />

      {/* Doc stack — left card (CV) */}
      <div
        className="absolute h-32 w-24 origin-bottom-right rounded-xl border border-[var(--border-soft)] bg-white shadow-[0_8px_32px_-12px_rgba(18,44,41,0.22)]"
        style={{ animation: "doc-left-fan 4s cubic-bezier(0.34,1.2,0.64,1) 0.5s infinite" }}
      >
        <div className="h-2.5 w-full rounded-t-xl bg-[var(--accent)]" />
        <div className="mt-3 space-y-1.5 px-3">
          {[100, 75, 88, 60, 80].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-[var(--border-strong)]" style={{ width: `${w}%` }} />
          ))}
        </div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">CV</p>
        {/* Checkmark */}
        <div
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] shadow-[0_2px_8px_rgba(18,108,100,0.5)]"
          style={{ animation: "check-pop 4s 0.5s infinite" }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Right card (Cover Letter) */}
      <div
        className="absolute h-32 w-24 origin-bottom-left rounded-xl border border-[var(--border-soft)] bg-white shadow-[0_8px_32px_-12px_rgba(18,44,41,0.22)]"
        style={{ animation: "doc-right-fan 4s cubic-bezier(0.34,1.2,0.64,1) 0.5s infinite" }}
      >
        <div className="h-2.5 w-full rounded-t-xl bg-amber-500" />
        <div className="mt-3 space-y-1.5 px-3">
          {[90, 70, 95, 55, 75].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-[var(--border-strong)]" style={{ width: `${w}%` }} />
          ))}
        </div>
        <p className="absolute bottom-2 left-0 right-0 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Letter</p>
        {/* Checkmark */}
        <div
          className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-[0_2px_8px_rgba(217,119,6,0.4)]"
          style={{ animation: "check-pop 4s 0.5s infinite" }}
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

const trackRows = [
  { company: "BrightPath Studio", role: "Product Designer", delay: "0s" },
  { company: "Hollow Arc", role: "UX Lead", delay: "0.18s" },
  { company: "Meridian Labs", role: "Content Strategist", delay: "0.36s" },
];

const STATUS_LABELS = ["Applied", "Interviewing", "Follow-up"] as const;

function TrackScene() {
  return (
    <div className="relative flex h-52 flex-col justify-center gap-2 overflow-hidden rounded-[1.4rem] bg-white px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(18,108,100,0.05),transparent)]" />
      {trackRows.map((row) => (
        <div
          key={row.company}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2"
          style={{ animation: `row-in 0.5s cubic-bezier(0.16,1,0.3,1) ${row.delay} both` }}
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--ink)]">{row.company}</p>
            <p className="truncate text-[10px] text-[var(--muted)]">{row.role}</p>
          </div>
          {/* Cycling status badge */}
          <div className="relative shrink-0">
            {STATUS_LABELS.map((label, i) => {
              const anim = ["status-a", "status-b", "status-c"][i];
              const color = i === 0
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : i === 1
                  ? "bg-amber-50 text-amber-600"
                  : "bg-blue-50 text-blue-600";
              return (
                <span
                  key={label}
                  className={`${i === 0 ? "relative" : "absolute inset-0"} inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${color}`}
                  style={{ animation: `${anim} 4s 1s infinite` }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      ))}
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
