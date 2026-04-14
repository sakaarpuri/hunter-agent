import Link from "next/link";
import {
  ArrowRight,
  CalendarDots,
  CheckCircle,
  ClockCountdown,
  EnvelopeSimpleOpen,
  FlowArrow,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { MockEmailBrief } from "@/components/mock-email-brief";
import { DashboardPreview } from "@/components/dashboard-preview";

const workflow = [
  {
    title: "We search daily",
    body: "HunterAgent checks for full-time, part-time, and contract roles every day so the user never has to start from a blank search tab.",
    icon: MagnifyingGlass,
  },
  {
    title: "You reply with the ones worth chasing",
    body: "The email stays simple: top 5 first, 5 more beneath, reply with numbers or names, then move on with the day.",
    icon: EnvelopeSimpleOpen,
  },
  {
    title: "The dashboard becomes the application studio",
    body: "A few minutes later the tailored CV, cover letter, work samples when relevant, and rationale are ready in one focused workspace.",
    icon: FlowArrow,
  },
  {
    title: "Follow-up only when it matters",
    body: "After the user applies, they can switch on a 7-day or 14-day reminder instead of being dragged into noisy automation by default.",
    icon: CalendarDots,
  },
];

const timingNotes = [
  ["First setup", "Send the first brief immediately or wait until the scheduled time."],
  ["Daily cadence", "Every later brief lands at the user’s chosen local time."],
  ["After reply", "The dashboard shows progress instantly, with a 2 to 10 minute estimate depending on how many roles were selected."],
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_top_left,rgba(18,108,100,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(164,126,77,0.12),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(18,42,39,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(18,42,39,0.05)_1px,transparent_1px)] [background-size:84px_84px]" />

      <header className="relative z-10 px-4 pt-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-[0_20px_55px_-34px_rgba(20,43,40,0.28)] backdrop-blur-md">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white shadow-[0_16px_36px_-22px_rgba(18,108,100,0.9)]">
              HA
            </span>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                HunterAgent
              </p>
              <p className="text-sm text-[var(--muted)]">Daily job scout and application studio</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
            >
              Open live flow
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="max-w-[44rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-4 py-2 text-sm font-medium text-[var(--muted)] shadow-[0_18px_38px_-28px_rgba(20,43,40,0.24)] backdrop-blur-sm">
                <ClockCountdown size={16} weight="duotone" />
                Daily brief at your chosen time, first send now or later
              </div>
              <h1 className="mt-8 text-5xl font-semibold tracking-[-0.06em] text-[var(--ink)] md:text-7xl md:leading-[0.94]">
                Stop searching job boards every day.
              </h1>
              <p className="mt-6 max-w-[40rem] text-lg leading-8 text-[var(--muted)] md:text-xl md:leading-9">
                Get 10 matched roles in your inbox each morning, with the top 5
                first. Reply with the ones you want, then review the application
                pack in your dashboard a few minutes later.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_-26px_rgba(18,108,100,0.9)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  Start daily briefs
                  <ArrowRight size={16} weight="bold" />
                </Link>
                <a
                  href="#brief"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  See sample email
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.8rem] border border-[var(--border-soft)] bg-white/88 p-5 shadow-[0_24px_55px_-34px_rgba(20,43,40,0.28)] backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    What makes it different
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                    <li className="flex gap-3"><CheckCircle size={18} weight="fill" className="mt-1 shrink-0 text-[var(--accent)]" /> Email handles shortlist delivery and simple commands only.</li>
                    <li className="flex gap-3"><CheckCircle size={18} weight="fill" className="mt-1 shrink-0 text-[var(--accent)]" /> The dashboard handles CVs, letters, optional work samples, and tracking.</li>
                    <li className="flex gap-3"><CheckCircle size={18} weight="fill" className="mt-1 shrink-0 text-[var(--accent)]" /> Follow-up stays opt-in after the user actually applies.</li>
                  </ul>
                </div>
                <div className="rounded-[1.8rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[0_24px_55px_-34px_rgba(20,43,40,0.24)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    Timing controls
                  </p>
                  <div className="mt-4 space-y-4 text-sm text-[var(--muted)]">
                    <div className="rounded-[1.3rem] bg-white px-4 py-3">
                      <p className="font-medium text-[var(--ink)]">First brief</p>
                      <p className="mt-1 leading-6">Send immediately or wait for the first scheduled slot.</p>
                    </div>
                    <div className="rounded-[1.3rem] bg-white px-4 py-3">
                      <p className="font-medium text-[var(--ink)]">Daily rhythm</p>
                      <p className="mt-1 leading-6">Every following brief lands at the user’s chosen local time.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div id="brief" className="lg:pl-8">
              <MockEmailBrief />
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Discovery to follow-up
                </p>
                <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)] md:text-5xl">
                  A clean user experience from shortlist to follow-up.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-8 text-[var(--muted)]">
                HunterAgent keeps the user out of repetitive search loops, steers the
                inbox into short command replies, then moves the heavier work into a
                quieter dashboard built for reviewing and shipping applications.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1.1fr]">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="rounded-[1.8rem] border border-[var(--border-soft)] bg-white p-6 shadow-[0_28px_60px_-42px_rgba(20,43,40,0.3)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Icon size={22} weight="duotone" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[0_28px_65px_-40px_rgba(20,43,40,0.26)] lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                Setup once
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
                Let the user choose when the brief shows up.
              </h2>
              <p className="mt-4 text-base leading-8 text-[var(--muted)]">
                Timing belongs in the product, not buried in support. The first brief
                can go out right away or at the selected time. After that, the daily
                email lands on the schedule the user expects.
              </p>

              <div className="mt-8 space-y-4">
                {timingNotes.map(([label, body]) => (
                  <div key={label} className="rounded-[1.5rem] border border-[var(--border-soft)] bg-white px-5 py-4">
                    <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--border-soft)] bg-white p-6 shadow-[0_28px_65px_-40px_rgba(20,43,40,0.26)] lg:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    Onboarding delivery step
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    Choose the daily brief rhythm.
                  </h3>
                </div>
                <span className="rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
                  Step 4 of 4
                </span>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-[1fr_0.9fr]">
                <div className="space-y-5">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--ink)]">Daily brief time</span>
                    <div className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)]">
                      8:00 AM
                    </div>
                    <span className="text-xs leading-6 text-[var(--muted)]">Every later daily brief lands at this time.</span>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--ink)]">Timezone</span>
                    <div className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)]">
                      Europe/London
                    </div>
                  </label>
                  <div className="grid gap-3 text-sm">
                    <span className="font-medium text-[var(--ink)]">First shortlist</span>
                    <div className="rounded-[1.3rem] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-[var(--ink)]">
                      Send immediately
                    </div>
                    <div className="rounded-[1.3rem] border border-[var(--border-strong)] bg-white px-4 py-3 text-[var(--muted)]">
                      Send at my scheduled time
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.6rem] bg-[var(--surface)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                    Preview
                  </p>
                  <div className="mt-4 rounded-[1.5rem] border border-[var(--border-soft)] bg-white p-4">
                    <p className="font-medium text-[var(--ink)]">You&apos;re set.</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      Your first shortlist will arrive now. After that, HunterAgent
                      will send your daily brief every morning at 8:00 AM Europe/London.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Dashboard preview
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)] md:text-5xl">
                  Where the application pack comes together.
                </h2>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
              >
                Open full dashboard
                <ArrowRight size={15} weight="bold" />
              </Link>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section className="px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1400px] rounded-[2.4rem] border border-[var(--border-soft)] bg-[var(--ink)] px-6 py-10 text-white shadow-[0_32px_80px_-42px_rgba(7,17,16,0.6)] sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Final product idea
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                  Email for shortlist selection. Dashboard for action.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">
                  HunterAgent keeps the user out of repetitive search loops,
                  prepares the right application assets fast, and only pulls
                  follow-up into the workflow when the user asks for it.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  Open live flow
                  <ArrowRight size={15} weight="bold" />
                </Link>
                <a
                  href="#brief"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  Jump back to the brief
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
