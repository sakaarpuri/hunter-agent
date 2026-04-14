"use client";

import { TrustExplanationModel, TrustSource } from "@/lib/hunteragent-trust";

type TrustExplanationPanelProps = {
  explanation: TrustExplanationModel;
  className?: string;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function sourceLabel(source: TrustSource) {
  if (source === "user") return "Grounded in user input";
  if (source === "role") return "Grounded in role data";
  return "Inferred by HunterAgent";
}

function sourceStyles(source: TrustSource) {
  if (source === "user") {
    return "border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--ink)]";
  }
  if (source === "role") {
    return "border-[color:rgba(17,61,55,0.18)] bg-[color:rgba(17,61,55,0.06)] text-[color:var(--ink)]";
  }
  return "border-[color:rgba(165,90,28,0.18)] bg-[color:rgba(165,90,28,0.08)] text-[color:var(--ink)]";
}

function SourceBadge({ source }: { source: TrustSource }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
        sourceStyles(source),
      )}
    >
      {sourceLabel(source)}
    </span>
  );
}

function SectionCard({
  title,
  summary,
  details,
}: {
  title: string;
  summary: string;
  details: Array<{ label: string; value: string; source: TrustSource }>;
}) {
  const grouped = {
    user: details.filter((item) => item.source === "user"),
    role: details.filter((item) => item.source === "role"),
    inferred: details.filter((item) => item.source === "inferred"),
  };

  return (
    <section className="rounded-[28px] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_16px_40px_rgba(10,20,18,0.04)]">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">{title}</p>
        <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)]">{summary}</p>
      </div>

      <div className="mt-5 space-y-4">
        {(Object.entries(grouped) as Array<[TrustSource, Array<{ label: string; value: string; source: TrustSource }>]>).map(
          ([source, items]) =>
            items.length > 0 ? (
              <div key={source} className="space-y-2">
                <SourceBadge source={source} />
                <div className="grid gap-3">
                  {items.map((item) => (
                    <div
                      key={`${source}-${item.label}`}
                      className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-[color:var(--ink)]">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
        )}
      </div>
    </section>
  );
}

export function TrustExplanationPanel({ explanation, className }: TrustExplanationPanelProps) {
  const groundingColumns: Array<{
    title: string;
    items: Array<{ label: string; value: string; source: TrustSource }>;
  }> = [
    { title: "Grounded in user input", items: explanation.grounding.user },
    { title: "Grounded in role data", items: explanation.grounding.role },
    { title: "Inferred by HunterAgent", items: explanation.grounding.inferred },
  ];

  return (
    <section className={cn("space-y-5", className)}>
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">Trust layer</p>
        <h2 className="font-[family-name:var(--font-geist-sans)] text-2xl font-semibold tracking-[-0.04em] text-[color:var(--ink)]">
          Why this pack looks the way it does
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
          Use this panel when you want to explain the selection logic, style choice, work-sample decision, and which parts came from the user versus HunterAgent inference.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title={explanation.roleSelection.title} summary={explanation.roleSelection.summary} details={explanation.roleSelection.details} />
        <SectionCard title={explanation.resumeStyle.title} summary={explanation.resumeStyle.summary} details={explanation.resumeStyle.details} />
        <section className="rounded-[28px] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_16px_40px_rgba(10,20,18,0.04)]">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">
              {explanation.workSamples.title}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">{explanation.workSamples.summary}</p>
          </div>

          <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Decision</div>
            <div className="mt-1 text-sm leading-6 text-[color:var(--ink)]">
              {explanation.workSamples.included ? "Included" : "Omitted"} - {explanation.workSamples.reason}
            </div>
          </div>

          {explanation.workSamples.selections.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">Selected samples</div>
              {explanation.workSamples.selections.map((sample) => (
                <article
                  key={`${sample.title}-${sample.href ?? sample.note}`}
                  className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3"
                >
                  <div className="text-sm font-semibold text-[color:var(--ink)]">{sample.title}</div>
                  <div className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{sample.note}</div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-[28px] border border-[color:var(--border-soft)] bg-white p-5 shadow-[0_16px_40px_rgba(10,20,18,0.04)]">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--muted)]">Grounding</p>
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            This is the compact audit trail for the studio. It makes it easier to see what came from the user, what came from the role posting, and what HunterAgent inferred.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {groundingColumns.map((column) => (
            <div key={column.title} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted)]">{column.title}</div>
              <div className="mt-3 space-y-3">
                {column.items.map((item) => (
                  <div key={`${column.title}-${item.label}`} className="space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{item.label}</div>
                    <div className="text-sm leading-6 text-[color:var(--ink)]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
