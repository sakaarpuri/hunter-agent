import {
  ArrowSquareOut,
  CalendarDots,
  CheckCircle,
  ClockCountdown,
  FileText,
  FolderOpen,
  Lightning,
  SlidersHorizontal,
  Sparkle,
  Tray,
} from "@phosphor-icons/react/dist/ssr";

type NavItem = {
  label: string;
  Icon: typeof Tray;
};

type ActivityItem = {
  time: string;
  label: string;
  Icon: typeof CalendarDots;
};

const selectedToday = [
  { number: "01", company: "BrightPath Studio", role: "Senior Product Designer", eta: "2 min left" },
  { number: "04", company: "Hollow Arc", role: "Product Designer", eta: "4 min left" },
];

const readyRoles = [
  { name: "Northline Health", pack: "Resume · Cover Letter · 3 links" },
  { name: "Meridian Labs", pack: "CV v1 · Letter v1 · 2 links" },
];

const applied = [
  { name: "Fieldnote", date: "Apr 13", status: "Follow-up off" },
  { name: "Quiet Orbit", date: "Apr 11", status: "7-day reminder" },
];

const navItems: NavItem[] = [
  { label: "Today", Icon: Tray },
  { label: "Preparing", Icon: Lightning },
  { label: "Ready", Icon: CheckCircle },
  { label: "Applied", Icon: FolderOpen },
  { label: "Follow Up", Icon: CalendarDots },
  { label: "Settings", Icon: SlidersHorizontal },
];

const activityItems: ActivityItem[] = [
  { time: "08:00", label: "Brief sent", Icon: CalendarDots },
  { time: "08:07", label: "Reply received", Icon: FileText },
  { time: "08:08", label: "Pack generation started", Icon: Lightning },
  { time: "08:11", label: "Ready for review", Icon: CheckCircle },
];

export function DashboardPreview({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[2rem] border border-[var(--border-soft)] bg-white shadow-[0_35px_85px_-38px_rgba(21,49,46,0.32)] ${fullPage ? "" : "max-w-[1280px]"}`}>
      <div className="grid min-h-[720px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="border-b border-[var(--border-soft)] bg-[var(--surface)] px-5 py-6 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                HunterAgent
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
                Daily roles at 8:00 AM
              </h2>
            </div>
            <button className="rounded-full border border-[var(--border-soft)] bg-white p-2 text-[var(--muted)]">
              <SlidersHorizontal size={18} />
            </button>
          </div>

          <nav className="mt-8 grid gap-2 text-sm">
            {navItems.map(({ label, Icon }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${label === "Today" ? "bg-[var(--accent)] text-white shadow-[0_20px_50px_-34px_rgba(18,108,100,0.9)]" : "text-[var(--muted)] hover:bg-white"}`}
              >
                <Icon size={18} weight={label === "Today" ? "fill" : "duotone"} />
                <span className="font-medium">{label}</span>
              </div>
            ))}
          </nav>

          <div className="mt-10 rounded-[1.7rem] border border-[var(--border-soft)] bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
              Delivery
            </p>
            <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Timezone</span>
                <span className="font-mono text-[var(--ink)]">Europe/London</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Brief time</span>
                <span className="font-mono text-[var(--ink)]">08:00</span>
              </div>
              <div className="flex items-center justify-between">
                <span>First brief</span>
                <span className="text-[var(--ink)]">Sent immediately</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="border-b border-[var(--border-soft)] px-5 py-6 lg:border-r lg:border-b-0 lg:px-6 xl:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Today
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-4xl">
                Reply received. Packs are moving.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                HunterAgent parsed your reply at 8:07 AM and is preparing 2
                application packs. Estimated time: 4 to 6 minutes.
              </p>
            </div>
            <div className="rounded-[1.6rem] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Latest activity
              </p>
              <p className="mt-2 font-mono text-sm text-[var(--ink)]">08:08 AM</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Generation started</p>
            </div>
          </div>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    Selected today
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
                    Active application queue
                  </h3>
                </div>
                <div className="status-pill">
                  <Sparkle size={14} weight="fill" /> 2 in progress
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {selectedToday.map((item, index) => (
                  <div key={item.company} className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4" style={{ animationDelay: `${index * 70}ms` }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] font-mono text-xs text-[var(--accent)]">
                          {item.number}
                        </div>
                        <div>
                          <p className="text-sm text-[var(--muted)]">{item.company}</p>
                          <h4 className="mt-1 text-lg font-semibold tracking-tight text-[var(--ink)]">
                            {item.role}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
                        <ClockCountdown size={14} weight="duotone" />
                        {item.eta}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-[var(--muted)] md:grid-cols-3">
                      <div className="rounded-2xl bg-[var(--surface)] px-3 py-3">CV tailored to product systems</div>
                      <div className="rounded-2xl bg-[var(--surface)] px-3 py-3">Letter tuned for hybrid team and metrics</div>
                      <div className="rounded-2xl bg-[var(--surface)] px-3 py-3">Portfolio links ranked for B2B proof</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Ready to review
                </p>
                <div className="mt-4 space-y-3">
                  {readyRoles.map((item) => (
                    <div key={item.name} className="flex items-start justify-between gap-3 rounded-[1.4rem] bg-white px-4 py-3">
                      <div>
                        <h4 className="font-semibold text-[var(--ink)]">{item.name}</h4>
                        <p className="mt-1 text-sm text-[var(--muted)]">{item.pack}</p>
                      </div>
                      <ArrowSquareOut size={18} className="mt-1 text-[var(--muted)]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Applications
                </p>
                <div className="mt-4 divide-y divide-[var(--border-soft)]">
                  {applied.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <h4 className="font-semibold text-[var(--ink)]">{item.name}</h4>
                        <p className="mt-1 text-sm text-[var(--muted)]">Applied {item.date}</p>
                      </div>
                      <span className="text-xs font-medium text-[var(--muted)]">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Activity log
                </p>
              </div>
              <span className="text-xs font-medium text-[var(--muted)]">4 events today</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {activityItems.map(({ time, label, Icon }) => (
                <div key={label} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-white px-4 py-4 text-sm text-[var(--muted)]">
                  <div className="flex items-center gap-2 font-mono text-xs text-[var(--accent)]">
                    <Icon size={14} weight="duotone" />
                    {time}
                  </div>
                  <p className="mt-3 font-medium text-[var(--ink)]">{label}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <section className="bg-[var(--surface)] px-5 py-6 lg:px-6 xl:px-7">
          <div className="rounded-[1.9rem] border border-[var(--border-soft)] bg-white p-5 shadow-[0_25px_55px_-40px_rgba(18,40,38,0.3)]">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
              Application studio
            </p>
            <div className="mt-4 border-b border-[var(--border-soft)] pb-4">
              <h3 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
                BrightPath Studio
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Senior Product Designer · London / Hybrid · Full-time · Posted 9h ago
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
              {[
                "CV",
                "Cover Letter",
                "Portfolio",
                "Pack",
              ].map((tab, index) => (
                <span
                  key={tab}
                  className={`rounded-full px-3.5 py-2 ${index === 2 ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)]"}`}
                >
                  {tab}
                </span>
              ))}
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Why this role fits
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted)]">
                  <p>Strong systems background and relevant B2B SaaS work.</p>
                  <p>Portfolio proof aligns with dashboards, activation, and collaboration.</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Portfolio picks
                </p>
                <div className="mt-3 space-y-3">
                  {[
                    ["Checkout redesign case study", "Close fit for product systems work"],
                    ["SaaS onboarding study", "Shows activation and retention thinking"],
                    ["Dashboard launch write-up", "Adds proof for B2B interface depth"],
                  ].map(([title, note]) => (
                    <div key={title} className="rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                      <h4 className="font-semibold text-[var(--ink)]">{title}</h4>
                      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">
                Turn on follow-up reminders after you apply.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]">
                  <FileText size={16} weight="fill" />
                  Edit assets
                </button>
                <button className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]">
                  <CheckCircle size={16} weight="fill" />
                  Mark applied
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
