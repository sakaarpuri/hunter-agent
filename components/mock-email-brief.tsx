import {
  ArrowRight,
  Briefcase,
  Clock,
  MapPin,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

const roles = [
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

const extraRoles = [
  "Senior UX Designer — Northline Health",
  "Brand Designer — Quiet Orbit",
  "Frontend Developer — Motion Bureau",
  "Content Designer — Fieldnote",
  "Product Marketer — Clear Harbor",
];

export function MockEmailBrief() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.8)] p-6 shadow-[0_24px_80px_-30px_rgba(27,58,53,0.25)] backdrop-blur-md sm:p-7">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/80" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            Daily brief
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--ink)]">
            Your 10 matched roles for today
          </h3>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] shadow-sm">
          <Clock size={14} weight="duotone" />
          Sent at 8:00 AM
        </div>
      </div>

      <div className="mb-5 rounded-[1.4rem] border border-[var(--border-soft)] bg-[var(--surface)]/90 p-4 text-sm leading-6 text-[var(--muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
        <p className="font-medium text-[var(--ink)]">Hi Alina,</p>
        <p className="mt-2">
          I found 10 roles that fit your profile today. Reply with the numbers or
          names you want me to prepare, then check your dashboard in about 2 to 10
          minutes depending on how many roles you choose.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
            Top picks
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
            Reply with numbers or names, e.g. 1, 4 or BrightPath →
            <ArrowRight size={14} />
          </div>
        </div>
        {roles.map((role, index) => (
          <article
            key={role.id}
            className="group rounded-[1.5rem] border border-[var(--border-soft)] bg-white/95 p-4 shadow-[0_18px_45px_-36px_rgba(14,34,32,0.45)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                {role.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-semibold tracking-tight text-[var(--ink)]">
                      {role.title}
                    </h4>
                    <p className="text-sm text-[var(--muted)]">{role.company}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
                    <Briefcase size={12} weight="fill" />
                    Selected
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                  <MapPin size={13} weight="duotone" />
                  {role.meta}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{role.note}</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
          Other matches today
        </p>
        <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
          {extraRoles.map((role, index) => (
            <div key={role} className="flex items-start gap-3 rounded-2xl bg-white/70 px-3 py-2.5">
              <span className="font-mono text-[11px] text-[var(--accent)]">0{index + 6}</span>
              <span>{role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 rounded-[1.4rem] bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white shadow-[0_18px_45px_-28px_rgba(18,108,100,0.9)]">
        <div className="flex items-center gap-2">
          <Sparkle size={16} weight="fill" />
          Reply to choose roles — full details in your dashboard.
        </div>
        <span className="rounded-full bg-white/14 px-3 py-1 text-xs">Open your dashboard</span>
      </div>
    </div>
  );
}
