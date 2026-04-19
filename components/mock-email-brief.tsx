import {
  ArrowRight,
  Briefcase,
  Clock,
  MapPin,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

const topRoles = [
  {
    id: 1,
    company: "BrightPath Studio",
    title: "Senior Product Designer",
    meta: "London / Hybrid / Full-time",
    note: "Why it fits: systems work, B2B SaaS, metrics-heavy team",
  },
  {
    id: 2,
    company: "Northline Health",
    title: "UX Writer",
    meta: "Remote / Part-time",
    note: "Why it fits: lifecycle content, product writing, healthcare",
  },
  {
    id: 3,
    company: "Riverframe",
    title: "Growth Marketer",
    meta: "Remote / Contract",
    note: "Why it fits: activation, email programs, experimentation",
  },
  {
    id: 4,
    company: "Hollow Arc",
    title: "Product Designer",
    meta: "Berlin / Remote / Full-time",
    note: "Why it fits: dashboard work, research collaboration, SaaS",
  },
  {
    id: 5,
    company: "Meridian Labs",
    title: "Content Strategist",
    meta: "Remote / Part-time",
    note: "Why it fits: editorial systems, product launches, B2B storytelling",
  },
];

const wildcardRoles = [
  {
    id: 6,
    company: "Wanderdesk",
    title: "Remote Experience Designer",
    meta: "Fully remote / Travel-friendly / Contract",
    note: "A wildcard: design rituals for a distributed team that operates across 12 time zones.",
  },
  {
    id: 7,
    company: "Atlas Journal",
    title: "Editorial Director",
    meta: "Lisbon / Nomad-friendly / Full-time",
    note: "A stretch pick: lead content for a slow-travel magazine with a fast-growing digital audience.",
  },
  {
    id: 8,
    company: "Basecamp Collective",
    title: "Community & Content Lead",
    meta: "Remote / Part-time",
    note: "A surprise: blend community building with storytelling for an outdoor adventure brand.",
  },
];

export function MockEmailBrief() {
  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.8)] p-6 shadow-[0_24px_80px_-30px_rgba(27,58,53,0.25)] backdrop-blur-md sm:p-7"
      style={{ maxHeight: "50rem" }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/80" />

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            Daily brief
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--ink)]">
            5 top roles + 3 wildcards today
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] shadow-sm">
          <Clock size={14} weight="duotone" />
          Sent at 8:00 AM
        </div>
      </div>

      {/* Body text */}
      <div className="mb-5 rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)]/90 p-4 text-sm leading-6 text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <p className="font-medium text-[var(--ink)]">Hi there,</p>
        <p className="mt-2">
          5 roles matched your profile today, plus 3 wildcards. To select any of
          them, just reply to this email with the job numbers — for example, type
          &quot;2 and 4&quot; to pick the second and fourth role. The AI builds your CV and
          cover letter for those two and they&apos;ll be waiting in your dashboard within
          minutes. Top picks are numbered 1–5, wildcards 6–8.
        </p>
      </div>

      {/* Top picks — show 3 full + 4th peeking */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            Top picks
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
            Reply e.g. 1, 4 or BrightPath →
            <ArrowRight size={14} />
          </div>
        </div>
        {topRoles.slice(0, 4).map((role, index) => (
          <article
            key={role.id}
            className="group rounded-[1.4rem] border border-[var(--border-soft)] bg-white/95 p-3 shadow-[0_18px_45px_-36px_rgba(14,34,32,0.45)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                {role.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-[var(--ink)]">{role.title}</h4>
                    <p className="text-xs text-[var(--muted)]">{role.company}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                    <Briefcase size={10} weight="fill" />
                    Matched
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <MapPin size={11} weight="duotone" />
                  {role.meta}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{role.note}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Wildcards — show 1 full + 2nd peeking */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-amber-600">
            <Sparkle size={12} weight="fill" />
            Wildcards
          </div>
          <p className="text-[10px] text-[var(--muted)]">Stretch picks — reply with 6, 7, or 8</p>
        </div>
        {wildcardRoles.slice(0, 2).map((role, index) => (
          <article
            key={role.id}
            className="group rounded-[1.4rem] border border-amber-100 bg-amber-50/60 p-3 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            style={{ animationDelay: `${(index + 5) * 90}ms` }}
          >
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-semibold text-amber-700">
                {role.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-[var(--ink)]">{role.title}</h4>
                    <p className="text-xs text-[var(--muted)]">{role.company}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <Sparkle size={9} weight="fill" />
                    Wildcard
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <MapPin size={11} weight="duotone" />
                  {role.meta}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">{role.note}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Gradient fade — trails off at the bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.97) 100%)",
        }}
      />
    </div>
  );
}
