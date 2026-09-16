"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  Compass,
  EnvelopeSimple,
  FlagCheckered,
  RocketLaunch,
  ShieldCheck,
  Sparkle,
  Waves,
} from "@phosphor-icons/react";
import { DREAM_JOB_EXAMPLES } from "@/lib/dream-job-examples";

const icons = [Camera, ShieldCheck, Waves, FlagCheckered, RocketLaunch];
type ExampleView = "brief" | "details";

export function BriefExperience() {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<number[]>([0, 1]);
  const [view, setView] = useState<ExampleView>("brief");
  const role = DREAM_JOB_EXAMPLES[active];
  const RoleIcon = icons[active];
  const reviewedDate = new Date(
    `${role.reviewedOn}T12:00:00Z`,
  ).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  function toggle(index: number) {
    setActive(index);
    setSelected((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b),
    );
  }

  function moveTab(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "brief"
        : event.key === "End"
          ? "details"
          : view === "brief"
            ? "details"
            : "brief";
    setView(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#example-${next}-tab`)
      ?.focus();
  }

  return (
    <div className="brief-experience dream-experience" id="interactive-brief">
      <div className="experience-toolbar">
        <div className="experience-label">
          <Compass size={15} /> A few real reasons to stay curious
        </div>
        <span className="sample-label">Real jobs · Demo collection</span>
      </div>
      <div className="experience-body">
        <aside className="experience-rail" aria-label="Example views">
          <span className="mini-mark" aria-hidden="true">
            h.
          </span>
          <button
            onClick={() => setView("brief")}
            aria-label="Example opportunities"
            aria-pressed={view === "brief"}
          >
            <EnvelopeSimple size={21} />
          </button>
          <button
            onClick={() => setView("details")}
            aria-label="Explore opportunity details"
            aria-pressed={view === "details"}
          >
            <Compass size={21} />
          </button>
        </aside>
        <div className="experience-main">
          <div className="experience-heading">
            <div>
              <p className="eyebrow">
                DREAM JOBS ARE PERSONAL. POSSIBILITY IS EVERYWHERE.
              </p>
              <h2>
                What would make
                <br />
                you look twice?
              </h2>
            </div>
            <span className="brief-number">
              05<span>REAL EXAMPLES</span>
            </span>
          </div>
          <p className="dream-demo-intro">
            From Arctic photography to leadership in Seoul. These show the
            range, not five matches for one person. Your own brief follows your
            experience and ambitions.
          </p>
          <div
            className="experience-tabs"
            role="tablist"
            aria-label="Explore the example"
          >
            {(
              [
                ["brief", "The possibilities"],
                ["details", "Look closer"],
              ] as const
            ).map(([id, label], index) => (
              <button
                key={id}
                id={`example-${id}-tab`}
                role="tab"
                tabIndex={view === id ? 0 : -1}
                onKeyDown={moveTab}
                aria-selected={view === id}
                aria-controls={`example-${id}-panel`}
                onClick={() => setView(id)}
              >
                0{index + 1} <span>{label}</span>
              </button>
            ))}
          </div>
          {view === "brief" ? (
            <div
              role="tabpanel"
              id="example-brief-panel"
              aria-labelledby="example-brief-tab"
              className="example-job-list"
            >
              {DREAM_JOB_EXAMPLES.map((item, index) => {
                const Icon = icons[index];
                return (
                  <div
                    key={item.id}
                    className={`example-job ${active === index ? "is-active" : ""}`}
                  >
                    <button
                      className="selection-control"
                      aria-label={`${selected.includes(index) ? "Deselect" : "Select"} ${item.title} at ${item.company}`}
                      aria-pressed={selected.includes(index)}
                      onClick={() => toggle(index)}
                    >
                      {selected.includes(index) && (
                        <Check weight="bold" size={13} />
                      )}
                    </button>
                    <button
                      className="example-job-open"
                      onClick={() => setActive(index)}
                      aria-expanded={active === index}
                      aria-controls={`example-reason-${index}`}
                    >
                      <span
                        className={`company-monogram dream-monogram is-${item.id}`}
                        aria-hidden="true"
                      >
                        <Icon size={22} />
                      </span>
                      <span className="example-job-title">
                        <span className="dream-job-category">
                          {item.category}
                        </span>
                        <strong>{item.hook}</strong>
                        <span className="dream-job-role">{item.title}</span>
                        <small>
                          {item.company} · {item.location}
                        </small>
                      </span>
                      <span className="dream-job-index" aria-hidden="true">
                        0{index + 1}
                      </span>
                    </button>
                    {active === index && (
                      <div
                        className="dream-role-expanded"
                        id={`example-reason-${index}`}
                      >
                        <p className="example-reason">
                          <Sparkle size={15} />
                          <span>
                            <strong>The possibility</strong> {item.appeal}
                          </span>
                        </p>
                        <div className="dream-role-links">
                          <button
                            className="text-link"
                            onClick={() => setView("details")}
                          >
                            The role, and the reality <ArrowRight size={14} />
                          </button>
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link"
                            aria-label={`View original listing for ${item.title} (opens in a new tab)`}
                          >
                            Original listing <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              role="tabpanel"
              id="example-details-panel"
              aria-labelledby="example-details-tab"
              className="opportunity-details"
            >
              <label className="opportunity-picker" htmlFor="dream-role-select">
                <span>Explore a real opportunity</span>
                <select
                  id="dream-role-select"
                  value={active}
                  onChange={(e) => setActive(Number(e.target.value))}
                >
                  {DREAM_JOB_EXAMPLES.map((item, index) => (
                    <option key={item.id} value={index}>
                      {selected.includes(index) ? "Selected: " : ""}
                      {item.company} · {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <article className="opportunity-paper">
                <div className="opportunity-heading">
                  <span
                    className={`company-monogram dream-monogram is-${role.id}`}
                    aria-hidden="true"
                  >
                    <RoleIcon size={25} />
                  </span>
                  <div>
                    <p className="eyebrow">{role.company}</p>
                    <h3>{role.title}</h3>
                    <p>{role.location}</p>
                  </div>
                </div>
                <p className="opportunity-hook">{role.hook}</p>
                <dl className="opportunity-facts">
                  <div>
                    <dt>Why it might be worth a move</dt>
                    <dd>{role.appeal}</dd>
                  </div>
                  <div>
                    <dt>What the employer asks for</dt>
                    <dd>{role.requirements}</dd>
                  </div>
                  <div>
                    <dt>The reality check</dt>
                    <dd>{role.reality}</dd>
                  </div>
                </dl>
                <div className="opportunity-source">
                  <p>
                    Listing reviewed{" "}
                    <time dateTime={role.reviewedOn}>{reviewedDate}</time>.
                    Availability can change.
                  </p>
                  <a
                    href={role.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    {role.sourceLabel} <ArrowUpRight size={15} />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </article>
              <p className="opportunity-next-step">
                When a role is right for you, HunterAgent helps prepare your CV
                and cover letter. Exploring this demo does not create an
                application.
              </p>
            </div>
          )}
          <div className="experience-bottom">
            <span aria-live="polite">
              {view === "brief"
                ? `${selected.length} ${selected.length === 1 ? "possibility" : "possibilities"} selected. Just exploring is enough.`
                : "A dream role still has to fit your real life."}
            </span>
            {view === "brief" ? (
              <button
                className="button button-dark button-small"
                disabled={!selected.length}
                onClick={() => {
                  setActive(selected[0]);
                  setView("details");
                }}
              >
                Explore my picks <ArrowRight size={15} />
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="button button-dark button-small"
              >
                Find my what if <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="experience-caption">
        <span>
          Employer listings reviewed 2 Sep 2026. An editorial snapshot, not a
          live vacancy feed.
        </span>
        <span>
          No employer affiliation. Check the original before applying.
        </span>
      </div>
    </div>
  );
}
