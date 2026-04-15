import Link from "next/link";
import {
  ArrowRight,
  CalendarDots,
  CheckCircle,
  EnvelopeSimpleOpen,
  FlowArrow,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { MockEmailBrief } from "@/components/mock-email-brief";
import { DashboardPreview } from "@/components/dashboard-preview";

const workflow = [
  {
    title: "5 top roles, every morning",
    body: "HunterAgent searches for full-time, part-time, and contract jobs daily. Your 5 top matches land in your inbox every morning — no job board tabs, no manual searching.",
    icon: MagnifyingGlass,
  },
  {
    title: "You pick the ones worth pursuing",
    body: "The email keeps it simple: top 5 first, 5 more below. Reply with numbers or company names. That's your entire input for the day.",
    icon: EnvelopeSimpleOpen,
  },
  {
    title: "We build your application materials",
    body: "A tailored CV, cover letter, and optional work samples are ready in your dashboard within minutes — specific to each role you picked.",
    icon: FlowArrow,
  },
  {
    title: "Follow up when you're ready",
    body: "After you apply, you can turn on a 7 or 14-day reminder. It's opt-in — no automated nudges unless you want them.",
    icon: CalendarDots,
  },
];

const timingNotes = [
  ["First delivery", "Send your first batch of roles immediately, or wait for your chosen time."],
  ["Every day after", "Your roles arrive at the same time each morning, in your timezone."],
  ["After you reply", "Your dashboard updates right away. Allow 2–10 minutes for the full application pack to generate."],
];

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[56rem] bg-[radial-gradient(ellipse_70%_55%_at_-8%_-8%,rgba(18,108,100,0.24),transparent),radial-gradient(ellipse_55%_45%_at_108%_-4%,rgba(164,126,77,0.16),transparent),radial-gradient(ellipse_38%_28%_at_52%_104%,rgba(18,108,100,0.08),transparent)]" />
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,rgba(18,42,39,0.13)_1px,transparent_1px)] [background-size:28px_28px]" />

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
              <p className="text-sm text-[var(--muted)]">Your daily job search, automated</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
          <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="max-w-[44rem]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/85 px-4 py-2 text-sm font-medium text-[var(--muted)] shadow-[0_18px_38px_-28px_rgba(20,43,40,0.24)] backdrop-blur-sm">
                <Sparkle size={16} weight="duotone" className="text-[var(--accent)]" />
                5 top matches in your inbox, every morning
              </div>
              <h1 className="mt-8 text-5xl font-semibold tracking-[-0.06em] text-[var(--ink)] md:text-7xl md:leading-[0.94]">
                Stop searching job boards every day.
              </h1>
              <p className="mt-6 max-w-[40rem] text-lg leading-8 text-[var(--muted)] md:text-xl md:leading-9">
                Get 5 curated roles in your inbox every morning. Reply with the ones
                you want — a tailored CV, cover letter, and work samples will be ready
                in your dashboard within minutes.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-3 rounded-full bg-[var(--accent)] pl-6 pr-2 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_-26px_rgba(18,108,100,0.9)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Get started free
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                    <ArrowRight size={14} weight="bold" />
                  </span>
                </Link>
                <a
                  href="#brief"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--ink)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  See a sample email
                </a>
              </div>

              <div className="mt-10 rounded-[1.8rem] border border-[var(--border-soft)] bg-white/88 p-5 shadow-[0_24px_55px_-34px_rgba(20,43,40,0.28)] backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  How it works differently
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)]">
                  <li className="flex gap-3"><CheckCircle size={18} weight="fill" className="mt-1 shrink-0 text-[var(--accent)]" /> Your email shows today&apos;s top matches. Reply with numbers — done.</li>
                  <li className="flex gap-3"><CheckCircle size={18} weight="fill" className="mt-1 shrink-0 text-[var(--accent)]" /> Your dashboard builds role-specific CVs, cover letters, and application materials.</li>
                  <li className="flex gap-3"><CheckCircle size={18} weight="fill" className="mt-1 shrink-0 text-[var(--accent)]" /> Follow-up reminders are optional — you turn them on after you apply.</li>
                </ul>
              </div>
            </div>
            <div id="brief" className="lg:pl-8">
              <MockEmailBrief />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div className="reveal">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                  How it works
                </p>
                <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)] md:text-5xl">
                  From search to application in minutes.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-8 text-[var(--muted)]">
                We handle the daily searching. You spend 30 seconds choosing roles.
                Your dashboard builds the applications — CVs, cover letters, and
                work samples tailored to each role you picked.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr_1.1fr]">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                const delayClass = ["reveal-delay-1", "reveal-delay-2", "reveal-delay-3", "reveal-delay-3"][index] as string;
                return (
                  <article
                    key={item.title}
                    className={`reveal ${delayClass} rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-[0_28px_60px_-42px_rgba(20,43,40,0.22)] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5`}
                  >
                    <div className="rounded-[calc(2rem-0.375rem)] bg-white p-6 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
                      <div className="inline-flex rounded-[1.15rem] border border-[rgba(18,108,100,0.14)] bg-gradient-to-br from-[rgba(18,108,100,0.12)] to-[rgba(18,108,100,0.02)] p-[5px] shadow-[0_6px_16px_-8px_rgba(18,108,100,0.22)]">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[calc(1.15rem-5px)] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] text-[var(--accent)]">
                          <Icon size={20} weight="duotone" />
                        </div>
                      </div>
                      <h3 className="mt-5 text-xl font-semibold tracking-tight text-[var(--ink)]">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Scheduling */}
        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="reveal rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[0_28px_65px_-40px_rgba(20,43,40,0.26)] lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Your schedule
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)]">
                Choose when your daily roles arrive.
              </h2>
              <p className="mt-4 text-base leading-8 text-[var(--muted)]">
                Pick the time that suits your morning. Your first batch can go out
                right away, or wait for your scheduled slot. After that, it runs
                automatically — same time, every day.
              </p>

              <div className="mt-8 space-y-4">
                {timingNotes.map(([label, body]) => (
                  <div key={label} className="rounded-[1.5rem] bg-white px-5 py-4 shadow-[inset_3px_0_0_var(--accent),0_0_0_1px_var(--border-soft)]">
                    <p className="text-sm font-semibold text-[var(--ink)]">{label}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal reveal-delay-1 rounded-[2rem] border border-[var(--border-soft)] bg-white p-6 shadow-[0_28px_65px_-40px_rgba(20,43,40,0.26)] lg:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                    Setup preview
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink)]">
                    When do you want your daily roles?
                  </h3>
                </div>
                <span className="rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
                  Step 4 of 4
                </span>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-[1fr_0.9fr]">
                <div className="space-y-5">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--ink)]">What time each morning?</span>
                    <div className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)]">
                      8:00 AM
                    </div>
                    <span className="text-xs leading-6 text-[var(--muted)]">Your roles arrive at this time every day.</span>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium text-[var(--ink)]">Your timezone</span>
                    <div className="rounded-[1.2rem] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-[var(--ink)]">
                      Europe/London
                    </div>
                  </label>
                  <div className="grid gap-3 text-sm">
                    <span className="font-medium text-[var(--ink)]">First batch</span>
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
                    <p className="font-medium text-[var(--ink)]">You&apos;re all set.</p>
                    <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                      Your first roles will arrive now. After that, HunterAgent
                      will send your daily batch every morning at 8:00 AM London time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard preview */}
        <section className="px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1400px]">
            <div className="reveal mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                Your dashboard
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-5">
                <h2 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--ink)] md:text-5xl">
                  Where your applications come together.
                </h2>
                <Link
                  href="/dashboard"
                  className="inline-flex shrink-0 items-center gap-3 rounded-full border border-[var(--border-strong)] bg-white pl-5 pr-2 py-2 text-sm font-semibold text-[var(--ink)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Open dashboard
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)]/8">
                    <ArrowRight size={14} weight="bold" />
                  </span>
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem]" style={{ height: "calc(720px * 0.72)" }}>
              <div style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "calc(100% / 0.72)" }}>
                <DashboardPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[1400px] rounded-[2.4rem] border border-[var(--border-soft)] bg-[var(--ink)] px-6 py-10 text-white shadow-[0_32px_80px_-42px_rgba(7,17,16,0.6)] sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  Simple by design
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">
                  Email to pick. Dashboard to apply.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-white/72">
                  No job board tabs. No copy-pasting CVs. No forgetting to follow up.
                  HunterAgent handles the repetitive parts so you can focus on the
                  conversations that matter.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-3 rounded-full bg-white pl-6 pr-2 py-2 text-sm font-semibold text-[var(--ink)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Get started free
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ink)]/20">
                    <ArrowRight size={14} weight="bold" />
                  </span>
                </Link>
                <a
                  href="#brief"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:translate-y-[1px] active:scale-[0.98]"
                >
                  See a sample email
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
