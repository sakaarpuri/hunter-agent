import { getResumeStyle } from "@/lib/hunteragent-data";
import { PackRecord, Profile, ResumeStyleId, Role } from "@/lib/hunteragent-types";

type CvPreviewProps = {
  profile: Profile;
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">;
  role?: Pick<Role, "company" | "title"> | null;
  styleId?: ResumeStyleId;
  className?: string;
};

type StyleTheme = {
  headingFontSize: string;
  summaryTone: string;
  accent: string;
  headerLayout: "stacked" | "split";
  sidebarTint: string;
};

type CvDocumentMetadata = {
  title: string;
  filename: string;
  description: string;
};

type CvPageModel = {
  bullets: string[];
  isFirst: boolean;
  pageNumber: number;
  totalPages: number;
};

function getStyleTheme(styleId: ResumeStyleId): StyleTheme {
  switch (styleId) {
    case "minimal":
      return {
        headingFontSize: "2rem",
        summaryTone: "#445451",
        accent: "#0f6a62",
        headerLayout: "stacked",
        sidebarTint: "#f4f2ea",
      };
    case "executive":
      return {
        headingFontSize: "2.15rem",
        summaryTone: "#3b4947",
        accent: "#0a4f49",
        headerLayout: "split",
        sidebarTint: "#f0ede3",
      };
    case "creative":
      return {
        headingFontSize: "2.2rem",
        summaryTone: "#4d4a44",
        accent: "#9c5b28",
        headerLayout: "split",
        sidebarTint: "#f5ece1",
      };
    case "modern":
    default:
      return {
        headingFontSize: "2.1rem",
        summaryTone: "#3f4c49",
        accent: "#0f6a62",
        headerLayout: "split",
        sidebarTint: "#f3f1e8",
      };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatList(values: string[]) {
  return values.filter(Boolean).map(normalizeText).join(" · ");
}

function slugify(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function splitBulletsIntoPages(bullets: string[]) {
  const source = bullets.length
    ? bullets
    : ["Tailor this section further to surface the strongest evidence for the selected role."];

  if (source.length <= 4) return [source];

  const pages: string[][] = [source.slice(0, 4)];
  let index = 4;

  while (index < source.length) {
    pages.push(source.slice(index, index + 5));
    index += 5;
  }

  return pages;
}

function getCvPageModels(bullets: string[]) {
  const pages = splitBulletsIntoPages(bullets);
  return pages.map<CvPageModel>((pageBullets, index) => ({
    bullets: pageBullets,
    isFirst: index === 0,
    pageNumber: index + 1,
    totalPages: pages.length,
  }));
}

function buildWorkProfile(profile: Profile) {
  return {
    location: normalizeText(profile.locations || "Open to remote and hybrid work"),
    workTypes: formatList(profile.workTypes),
    targetRoles: formatList(profile.targetRoles),
    coreStrength: normalizeText(profile.coreStrength || profile.guidedResume.professionalSummary || "Strong cross-functional product experience"),
    skills: normalizeText(profile.guidedResume.skills || "Design systems, Figma, product thinking"),
    education: normalizeText(profile.guidedResume.education || "Education details available in the working draft"),
  };
}

function getDocumentTitle(profile: Profile, role?: Pick<Role, "company" | "title"> | null) {
  const base = `HunterAgent CV - ${normalizeText(profile.name || "Candidate")}`;
  if (!role) return `${base} - ${normalizeText(profile.currentTitle || "Resume")}`;
  return `${base} - ${normalizeText(role.title || profile.currentTitle || "Resume")} - ${normalizeText(role.company || "Target company")}`;
}

function getDocumentFilename(profile: Profile, styleId: ResumeStyleId, role?: Pick<Role, "company" | "title"> | null) {
  const titlePart = slugify(role?.title || profile.currentTitle || "resume");
  const namePart = slugify(profile.name || "candidate");
  const companyPart = role?.company ? `-${slugify(role.company)}` : "";
  const stylePart = slugify(getResumeStyle(styleId).label);
  return `hunteragent-cv-${namePart}-${titlePart}${companyPart}-${stylePart}.pdf`;
}

function getDocumentDescription(
  profile: Profile,
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">,
  role?: Pick<Role, "company" | "title"> | null,
) {
  const summary = normalizeText(pack.cvSummary || "");
  const descriptor = role
    ? `${normalizeText(profile.name || "Candidate")} - ${normalizeText(role.title || profile.currentTitle || "Resume")} - ${normalizeText(role.company || "Target company")}`
    : `${normalizeText(profile.name || "Candidate")} - ${normalizeText(profile.currentTitle || "Resume")}`;
  return summary ? `${descriptor}. ${summary}` : descriptor;
}

export function getCvExportMetadata(
  profile: Profile,
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">,
  styleId: ResumeStyleId,
  role?: Pick<Role, "company" | "title"> | null,
): CvDocumentMetadata {
  return {
    title: getDocumentTitle(profile, role),
    filename: getDocumentFilename(profile, styleId, role),
    description: getDocumentDescription(profile, pack, role),
  };
}

function renderPageShell(
  profile: Profile,
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">,
  styleId: ResumeStyleId,
  page: CvPageModel,
) {
  const theme = getStyleTheme(styleId);
  const resumeStyle = getResumeStyle(styleId);
  const profileCopy = buildWorkProfile(profile);
  const compactContext = [profileCopy.location, profileCopy.workTypes].filter(Boolean).join(" · ");

  return `
    <section class="page ${page.isFirst ? "page-primary" : "page-continuation"}">
      <div class="page-shell">
        <header class="page-header ${page.isFirst ? theme.headerLayout : "page-header--compact"} ${page.isFirst ? "" : "page-header--continuation"}">
          <div>
            <div class="page-eyebrow">${escapeHtml(page.isFirst ? `${resumeStyle.label} resume` : "continued resume")}</div>
            <h1 class="page-name">${escapeHtml(profile.name || "Candidate")}</h1>
            <p class="page-title">${escapeHtml(profile.currentTitle || "Resume")}</p>
          </div>
          ${page.isFirst
            ? `
              <div class="page-header-meta">
                <div>${escapeHtml(profileCopy.location)}</div>
                <div>${escapeHtml(profileCopy.workTypes)}</div>
              </div>
            `
            : `
              <div class="page-header-meta page-header-meta--continuation">
                <div>${escapeHtml(compactContext)}</div>
              </div>
            `}
        </header>

        ${page.isFirst
          ? `
            <div class="page-content page-content--first">
              <aside class="side-panel">
                <div class="side-block">
                  <p class="label">Open to</p>
                  <p class="value">${escapeHtml(profileCopy.targetRoles || profile.currentTitle || "Selected role")}</p>
                </div>
                <div class="side-block">
                  <p class="label">Core strengths</p>
                  <p class="value">${escapeHtml(profileCopy.coreStrength)}</p>
                </div>
                <div class="side-block">
                  <p class="label">Skills</p>
                  <p class="value">${escapeHtml(profileCopy.skills)}</p>
                </div>
              </aside>

              <main class="content">
                <section class="content-group">
                  <p class="label">Summary</p>
                  <p class="summary">${escapeHtml(normalizeText(pack.cvSummary))}</p>
                </section>

                <section class="content-group">
                  <p class="label">Selected impact</p>
                  <ul class="bullet-list">
                    ${page.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
                  </ul>
                </section>

                <section class="content-group">
                  <p class="label">Education</p>
                  <p class="copy">${escapeHtml(profileCopy.education)}</p>
                </section>
              </main>
            </div>
          `
          : `
            <div class="page-content page-content--continuation">
              <div class="continuation-banner">
                <span class="continuation-badge">Continuation</span>
                <span class="continuation-summary">${escapeHtml(compactContext || "Additional evidence and impact")}</span>
              </div>

              <main class="content content--continuation">
                <section class="content-group">
                  <p class="label">Continued impact</p>
                  <ul class="bullet-list">
                    ${page.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
                  </ul>
                </section>
              </main>
            </div>
          `}

        ${page.totalPages > 1 ? `<footer class="page-foot">Page ${page.pageNumber} of ${page.totalPages}</footer>` : ""}
      </div>
    </section>
  `;
}

function buildPrintableBody(
  profile: Profile,
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">,
  styleId: ResumeStyleId,
  role?: Pick<Role, "company" | "title"> | null,
) {
  const theme = getStyleTheme(styleId);
  const metadata = getCvExportMetadata(profile, pack, styleId, role);
  const pages = getCvPageModels(pack.cvBullets);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <meta name="application-name" content="HunterAgent" />
        <meta name="description" content="${escapeHtml(metadata.description)}" />
        <meta name="robots" content="noindex, nofollow" />
        <title>${escapeHtml(metadata.title)}</title>
        <style>
          :root {
            color-scheme: light only;
            --ink: #1d2c2a;
            --muted: #3f4c49;
            --border-soft: rgba(23, 41, 38, 0.12);
          }
          * { box-sizing: border-box; }
          html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body {
            margin: 0;
            min-height: 100vh;
            background: #ece8de;
            color: var(--ink);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 18px auto;
            padding: 16mm 15mm 14mm;
            background: #fffdf8;
            border: 1px solid var(--border-soft);
            border-radius: 24px;
            box-shadow: 0 30px 70px rgba(21, 49, 46, 0.12);
            position: relative;
            overflow: hidden;
          }
          .page-shell { min-height: 100%; display: flex; flex-direction: column; }
          .page-header {
            display: grid;
            gap: 12px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(28, 47, 43, 0.11);
          }
          .page-header.split { grid-template-columns: minmax(0, 1fr) auto; align-items: end; }
          .page-header--compact { padding-bottom: 12px; }
          .page-header--continuation { padding-top: 2px; }
          .page-eyebrow {
            text-transform: uppercase;
            letter-spacing: 0.2em;
            font-size: 10px;
            color: ${theme.accent};
            font-weight: 700;
          }
          .page-name {
            margin: 8px 0 0;
            font-size: ${theme.headingFontSize};
            line-height: 1;
            letter-spacing: -0.035em;
          }
          .page-title {
            margin: 8px 0 0;
            color: ${theme.summaryTone};
            font-size: 15px;
            line-height: 1.55;
          }
          .page-header-meta {
            text-align: right;
            font-size: 12px;
            line-height: 1.75;
            color: #566561;
          }
          .page-header-meta--continuation {
            text-align: left;
            color: #64736f;
          }
          .page-content {
            flex: 1;
            display: grid;
            gap: 18px;
            margin-top: 16px;
          }
          .page-content--first { grid-template-columns: 162px minmax(0, 1fr); }
          .page-content--continuation { grid-template-columns: minmax(0, 1fr); }
          .side-panel {
            background: ${theme.sidebarTint};
            border-radius: 18px;
            padding: 14px;
            break-inside: avoid;
          }
          .side-block + .side-block { margin-top: 14px; }
          .label {
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            font-size: 10px;
            color: ${theme.accent};
            font-weight: 700;
          }
          .value, .copy, li, .summary {
            margin: 0;
            color: #31403d;
            font-size: 13px;
            line-height: 1.75;
          }
          .summary {
            font-size: 14px;
            line-height: 1.8;
            color: ${theme.summaryTone};
          }
          .content { min-width: 0; }
          .content--continuation { padding-top: 2px; }
          .content-group + .content-group { margin-top: 18px; }
          .bullet-list {
            margin: 10px 0 0;
            padding-left: 18px;
          }
          .bullet-list li { break-inside: avoid; }
          .bullet-list li + li { margin-top: 9px; }
          .continuation-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding-top: 2px;
            color: #66726e;
          }
          .continuation-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 10px;
            font-weight: 700;
            color: ${theme.accent};
          }
          .continuation-badge::before {
            content: "";
            width: 22px;
            height: 1px;
            background: ${theme.accent};
            opacity: 0.35;
          }
          .continuation-summary {
            font-size: 12px;
            line-height: 1.6;
            text-align: right;
            color: #65716d;
          }
          .page-foot {
            position: absolute;
            right: 15mm;
            bottom: 10mm;
            font-size: 10px;
            color: #6a7671;
            letter-spacing: 0.02em;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
          @media print {
            body {
              background: #fff;
              min-height: auto;
            }
            .page {
              width: auto;
              min-height: auto;
              margin: 0;
              border: none;
              border-radius: 0;
              box-shadow: none;
              break-after: page;
              page-break-after: always;
            }
            .page:last-child {
              break-after: auto;
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        ${pages.map((page) => renderPageShell(profile, pack, styleId, page)).join("")}
      </body>
    </html>
  `;
}

export function buildCvPrintHtml(
  profile: Profile,
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">,
  styleId: ResumeStyleId,
  role?: Pick<Role, "company" | "title"> | null,
) {
  return buildPrintableBody(profile, pack, styleId, role);
}

function renderPreviewPage(
  profile: Profile,
  pack: Pick<PackRecord, "cvSummary" | "cvBullets" | "resumeStyleUsed">,
  styleId: ResumeStyleId,
  page: CvPageModel,
) {
  const theme = getStyleTheme(styleId);
  const resumeStyle = getResumeStyle(styleId);
  const profileCopy = buildWorkProfile(profile);
  const compactContext = [profileCopy.location, profileCopy.workTypes].filter(Boolean).join(" · ");

  return (
    <section
      key={`${styleId}-${page.pageNumber}`}
      className="mx-auto w-full max-w-[740px] rounded-[2rem] border border-[rgba(16,32,30,0.08)] bg-[#fffdf8] p-7 shadow-[0_24px_50px_-32px_rgba(18,40,38,0.3)]"
    >
      <div className={`grid gap-4 border-b border-[var(--border-soft)] ${page.isFirst ? "pb-5" : "pb-4"} ${page.isFirst && theme.headerLayout === "split" ? "md:grid-cols-[minmax(0,1fr)_auto] md:items-end" : ""}`}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: theme.accent }}>
            {page.isFirst ? `${resumeStyle.label} resume` : "continued resume"}
          </p>
          <h3 className="mt-2 font-semibold tracking-tight text-[var(--ink)]" style={{ fontSize: theme.headingFontSize, lineHeight: 1 }}>
            {profile.name}
          </h3>
          <p className="mt-2 text-sm" style={{ color: theme.summaryTone }}>
            {profile.currentTitle}
          </p>
        </div>
        <div className={`text-sm leading-7 text-[var(--muted)] ${page.isFirst ? "md:text-right" : ""}`}>
          {page.isFirst ? (
            <>
              <div>{profileCopy.location}</div>
              <div>{profileCopy.workTypes}</div>
            </>
          ) : (
            <div>{compactContext || "Additional evidence and impact"}</div>
          )}
        </div>
      </div>

      {page.isFirst ? (
        <div className="mt-5 grid gap-4 md:grid-cols-[170px_minmax(0,1fr)]">
          <aside className="rounded-[1.5rem] p-4" style={{ backgroundColor: theme.sidebarTint }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Open to
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{profileCopy.targetRoles || profile.currentTitle || "Selected role"}</p>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Core strengths
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{profileCopy.coreStrength}</p>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Skills
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{profileCopy.skills}</p>
            </div>
          </aside>

          <div className="space-y-5">
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Summary
              </p>
              <p className="mt-2 text-sm leading-7" style={{ color: theme.summaryTone }}>
                {pack.cvSummary}
              </p>
            </section>

            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Selected impact
              </p>
              <ul className="mt-2 space-y-3 pl-5 text-sm leading-7 text-[var(--muted)]">
                {page.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </section>

            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
                Education
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{profileCopy.education}</p>
            </section>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
            <span className="inline-flex items-center gap-2">
              <span className="h-px w-6 bg-current opacity-30" />
              Continuation
            </span>
            <span className="text-[var(--muted)]" style={{ color: theme.summaryTone }}>
              {compactContext || "Additional evidence and impact"}
            </span>
          </div>

          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.accent }}>
              Continued impact
            </p>
            <ul className="mt-2 space-y-3 pl-5 text-sm leading-7 text-[var(--muted)]">
              {page.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {page.totalPages > 1 && (
        <div className="mt-5 text-right text-xs text-[var(--muted)]">
          Page {page.pageNumber} of {page.totalPages}
        </div>
      )}
    </section>
  );
}

export function CvPreview({ profile, pack, role, styleId = pack.resumeStyleUsed, className }: CvPreviewProps) {
  const pages = getCvPageModels(pack.cvBullets);
  const metadata = getCvExportMetadata(profile, pack, styleId, role);

  return (
    <div className={className} data-export-title={metadata.title} data-export-filename={metadata.filename}>
      {pages.map((page) => renderPreviewPage(profile, pack, styleId, page))}
    </div>
  );
}
