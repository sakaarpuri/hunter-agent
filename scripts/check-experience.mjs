import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";
import { chromium } from "playwright";

// Exercise the isolated fixture with an injected clock, without a browser or live APIs.
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
function loadFixtureModule(relative) {
  const filename = path.join(root, relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const fixtureModule = { exports: {} };
  modules.set(filename, fixtureModule);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = (name) => {
    if (name === "./hunteragent-flow") return {};
    if (name.startsWith("@/lib/")) return loadFixtureModule(`${name.slice(2)}.ts`);
    return require(name);
  };
  new Function("require", "module", "exports", source)(localRequire, fixtureModule, fixtureModule.exports);
  return fixtureModule.exports;
}

const { createPreviewTransport } = loadFixtureModule("components/design-workspace.tsx");
const { normalizeBriefPreferences, JOB_RETENTION_MS } = loadFixtureModule("lib/hunteragent-retention.ts");
const { shouldDiscoverNow } = loadFixtureModule("lib/hunteragent-scheduling.ts");
const { DAILY_ROLES } = loadFixtureModule("lib/hunteragent-data.ts");
const { suggestionExpiry } = loadFixtureModule("components/hunteragent-context.tsx");
const testNow = new Date();
testNow.setUTCHours(12, 0, 0, 0);
testNow.setUTCDate(testNow.getUTCDate() + (8 - testNow.getUTCDay()) % 7);
assert.equal(suggestionExpiry({ firstSeenAt: testNow.toISOString(), expiresAt: new Date(testNow.getTime() - 1000).toISOString() }, testNow.getTime()).expired, true, "An earlier explicit expiry is respected");
assert.equal(suggestionExpiry({}, testNow.getTime()).label, "Expiry unavailable; not selectable");
for (const invalid of [undefined, null, 1, 2, 4, "3", 0, -1, 99]) {
  assert.equal(normalizeBriefPreferences({ jobsPerBrief: invalid }).jobsPerBrief, 3);
}
{
  const transport = createPreviewTransport("onboarding", () => new Date(testNow));
  let state = await transport("/api/workspace");
  assert.equal(state.profile.jobsPerBrief, 3);
  assert.equal(state.profile.discoveryCadence, "daily");
  const profile = { ...state.profile, jobsPerBrief: 3, discoveryCadence: "daily" };
  await transport("/api/workspace", { action: "sync_draft", profile, onboardingStep: 3 });
  await transport("/api/workspace", { action: "finish_onboarding" });
  state = await transport("/api/workspace", { action: "send_first_brief_now" });
  assert.equal(state.profile.jobsPerBrief, 3);
  assert.equal(state.profile.discoveryCadence, "daily");
  assert.equal(state.briefs[0].roleIds.length, 3);
  assert.equal(state.briefs[0].topRoleIds.length, 3);
  assert.ok(Math.abs(Date.parse(state.briefs[0].createdAt) - testNow.getTime()) < 1000);
  state = await transport("/api/inbound-email", { briefId: state.activeBriefId, rawText: "1, 2" });
  assert.equal(state.packs.length, 0, "Saving a selection must not generate materials");
  assert.equal(state.flowPhase, "brief");
  state = await transport("/api/generate-packs", { briefId: state.activeBriefId });
  assert.equal(state.packs.length, 2, "Only explicit generation prepares materials");
  state = await transport("/api/workspace", { action: "update_profile", profile: { ...profile, jobsPerBrief: 1 } });
  assert.equal(state.profile.jobsPerBrief, 3, "Unsupported counts never persist");
}
{
  const transport = createPreviewTransport("waiting", () => new Date(testNow));
  const seen = new Set();
  let smallerBrief = false;
  for (let run = 0; run <= DAILY_ROLES.length; run++) {
    const state = await transport("/api/workspace", { action: "send_first_brief_now" });
    if (state.lastError) {
      assert.match(state.lastError, /No genuine new matches/);
      assert.equal(seen.size, DAILY_ROLES.length);
      break;
    }
    const ids = state.briefs[0].roleIds;
    if (ids.length < state.profile.jobsPerBrief) smallerBrief = true;
    for (const id of ids) { assert.ok(!seen.has(id), "No repeat jobs"); seen.add(id); }
  }
  assert.ok(smallerBrief || DAILY_ROLES.length % 3 === 0, "Never pad a small brief");
}
{
  let now = new Date(testNow);
  const transport = createPreviewTransport("studio", () => now);
  let state = await transport("/api/workspace");
  const briefId = state.activeBriefId;
  const savedRole = state.packs[0].roleId;
  await transport("/api/workspace", { action: "mark_applied", roleId: savedRole });
  now = new Date(testNow.getTime() + JOB_RETENTION_MS + 1000);
  state = await transport("/api/workspace");
  assert.equal(state.packs.length, 2);
  assert.equal(state.appliedRecords.length, 1);
  assert.ok(state.briefs.every((brief) => brief.selectedRoleIds.length === 0));
  assert.ok(state.roleCatalog.some((role) => role.id === savedRole));
  await transport("/api/workspace", { action: "set_active_brief", briefId });
  state = await transport("/api/workspace", { action: "set_active_role", roleId: savedRole });
  assert.equal(state.activeRoleId, savedRole);
  await assert.rejects(transport("/api/inbound-email", { briefId, rawText: "1" }));
}
{
  let now = new Date(testNow);
  const transport = createPreviewTransport("studio", () => now);
  const before = await transport("/api/workspace");
  now = new Date(now.getTime() + JOB_RETENTION_MS + 1000);
  let state = await transport("/api/workspace");
  assert.equal(state.briefs.length, 0, "Suggestion brief is archived after expiry");
  assert.equal(state.packs.length, before.packs.length, "Archiving never deletes generated documents");
  await transport("/api/workspace", { action: "set_active_brief", briefId: before.activeBriefId });
  state = await transport("/api/workspace", { action: "set_active_role", roleId: before.packs[1].roleId });
  assert.equal(state.activeRoleId, before.packs[1].roleId);
}
{
  const transport = createPreviewTransport("waiting", () => new Date(testNow));
  const { profile } = await transport("/api/workspace");
  const tuesday = new Date(testNow.getTime() + 86400000);
  const wednesday = new Date(testNow.getTime() + 2 * 86400000);
  assert.equal(shouldDiscoverNow({ ...profile, timezone: "UTC" }, testNow.toISOString(), tuesday), true);
  assert.equal(shouldDiscoverNow({ ...profile, timezone: "UTC", discoveryCadence: "three-per-week" }, testNow.toISOString(), tuesday), false);
  assert.equal(shouldDiscoverNow({ ...profile, timezone: "UTC", discoveryCadence: "three-per-week" }, testNow.toISOString(), wednesday), true);
}
console.log("PASS: fixed three-job briefs, count normalization, new-only pool, cadence, explicit generation and seven-day saved-history safety");

const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/hunteragent-experience";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: "reduce",
});
const errors = [];
const apiCalls = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (request.url().includes("/api/")) {
    apiCalls.push(request.url());
    const body = request.postDataJSON();
    if (body?.profile?.jobsPerBrief !== undefined) assert.equal(body.profile.jobsPerBrief, 3, "Only the fixed three-job brief size may be sent to APIs");
  }
});
page.setDefaultTimeout(10000);

async function visible(locator) {
  await locator.waitFor({ state: "visible" });
}
async function value(locator, expected) {
  await page.waitForFunction(
    ({ selector, expected }) =>
      document.querySelector(selector)?.value === expected,
    {
      selector: await locator.evaluate((el) => `#${CSS.escape(el.id)}`),
      expected,
    },
  );
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Horizontal overflow",
  );
}
async function openState(state) {
  await page.goto(`${base}/design-preview?state=${state}`);
  await visible(page.locator(".workspace-shell"));
}

try {
  const homepageResponse = await page.goto(base);
  assert.equal(homepageResponse?.headers()["x-content-type-options"], "nosniff");
  assert.equal(homepageResponse?.headers()["x-frame-options"], "DENY");
  assert.equal(homepageResponse?.headers()["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(homepageResponse?.headers()["permissions-policy"] ?? "", /camera=\(\)/);
  await visible(
    page.getByRole("heading", { name: "What if this was work?" }),
  );
  assert.equal(
    await page.getByRole("link", { name: "Sign in" }).getAttribute("href"),
    "/dashboard?mode=signin",
  );
  await page
    .getByRole("button", {
      name: "Deselect Aurora & Fjord Tour Guide at Northern Horizon",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Deselect Chief Information Security Officer at Channel Corp.",
      exact: true,
    })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Explore my picks" }).isDisabled(),
    true,
  );
  await page
    .getByRole("button", {
      name: "Select Marine Biologist at Six Senses Kanuhura",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Explore my picks" }).click();
  await visible(
    page.getByRole("heading", { name: "Marine Biologist", exact: true }),
  );
  await visible(page.getByText("The reality check", { exact: true }));
  const companies = [
    "Northern Horizon",
    "Channel Corp.",
    "Six Senses Kanuhura",
    "McLaren Racing",
    "SpaceX",
  ];
  const domains = [
    "northernhorizon.no",
    "jobs.lever.co",
    "careers.ihg.com",
    "jobs.smartrecruiters.com",
    "job-boards.greenhouse.io",
  ];
  for (let index = 0; index < companies.length; index++) {
    await page
      .getByLabel("Explore a real opportunity")
      .selectOption(String(index));
    await visible(
      page
        .locator(".opportunity-heading .eyebrow")
        .filter({ hasText: companies[index] }),
    );
    const source = page.locator(".opportunity-source a");
    assert.equal(
      new URL(await source.getAttribute("href")).hostname,
      domains[index],
    );
    assert.equal(await source.getAttribute("target"), "_blank");
    assert.ok((await source.getAttribute("rel")).includes("noopener"));
    assert.equal(
      await page.locator(".opportunity-source time").getAttribute("datetime"),
      "2026-09-02",
    );
    assert.equal(await page.locator(".opportunity-facts > div").count(), 3);
  }
  await visible(page.getByText(/not a live vacancy feed/).first());
  await page.getByRole("tab", { name: "02 Look closer" }).focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page
      .getByRole("tab", { name: "01 The possibilities" })
      .getAttribute("aria-selected"),
    "true",
  );
  await noOverflow();
  await page.screenshot({
    path: `${output}/homepage-desktop.png`,
    animations: "disabled",
  });
  console.log(
    "PASS: dream-job homepage, five sourced examples, requirements, selection and keyboard tabs",
  );

  await page.goto(`${base}/dashboard?mode=signin`);
  await visible(page.getByRole("heading", { name: "Welcome back." }));
  await page
    .getByLabel("Email address", { exact: true })
    .fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Example123!");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Test sign-in error. Your entries are preserved." },
    }),
  );
  await page.locator('button[type="submit"]').click();
  await visible(page.getByRole("alert"));
  assert.equal(
    await page.getByLabel("Email address", { exact: true }).inputValue(),
    "test@example.test",
  );
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.route("**/api/auth/forgot-password", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.getByRole("button", { name: "Send reset link" }).click();
  await visible(page.getByRole("heading", { name: "Check your inbox" }));
  await page.goto(`${base}/dashboard`);
  await visible(page.getByRole("heading", { name: "Good work starts here." }));
  await page.screenshot({
    path: `${output}/signup-desktop.png`,
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "PASS: logged-out route needs no database, account modes, form feedback (mocked auth)",
  );
  apiCalls.length = 0;

  await openState("brief");
  assert.equal(
    await page
      .locator(".workspace-shell")
      .evaluate((el) => el.classList.contains("rail-compact")),
    true,
  );
  await page.locator(".real-role .selection-control").nth(0).click();
  await page.locator(".real-role .selection-control").nth(2).click();
  assert.equal(await page.getByRole("tab", { name: "CV", exact: true }).count(), 0, "Selecting alone must not open generated materials");
  await page.getByRole("button", { name: "Save selected roles", exact: true }).click();
  assert.equal(await page.getByRole("tab", { name: "CV", exact: true }).count(), 0, "Saving selections must not generate");
  const expectedCompanies = await page
    .locator(".real-role.is-selected .role-title > p")
    .allTextContents();
  await page
    .getByRole("button", { name: "Prepare my materials", exact: true })
    .click();
  await visible(page.getByRole("tab", { name: "CV", exact: true }));
  const roleOptions = await page
    .locator("#active-role-select option")
    .allTextContents();
  assert.equal(roleOptions.length, 2);
  expectedCompanies.forEach((company) =>
    assert.ok(roleOptions.some((option) => option.includes(company))),
  );
  console.log("PASS: role selection maps to the correct studio roles");

  await page.getByRole("button", { name: "Refine", exact: true }).click();
  const instruction = page.getByLabel("What would you like to change?");
  await instruction.fill("Emphasise research leadership");
  await page.getByRole("tab", { name: "Cover Letter", exact: true }).click();
  await value(instruction, "");
  await instruction.fill("Keep the opening direct");
  await page.getByRole("tab", { name: "CV", exact: true }).click();
  await value(instruction, "Emphasise research leadership");
  await page.getByRole("button", { name: "Update CV", exact: true }).click();
  await visible(page.getByText("Recent instructions", { exact: false }));
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await value(instruction, "");
  await page
    .locator(".studio-subdetails summary")
    .filter({ hasText: "Recent instructions" })
    .click();
  await page
    .getByRole("button", { name: "Emphasise research leadership", exact: true })
    .click();
  await value(instruction, "Emphasise research leadership");
  console.log(
    "PASS: prompt isolation, immediate tab switching, clear and history reuse",
  );

  const summary =
    "Product designer with experience in research, systems, and end-to-end delivery.";
  await page.getByRole("button", { name: /CV layout/ }).click();
  for (const style of ["Minimal", "Modern", "Executive", "Creative"]) {
    await page
      .locator(".studio-style-option")
      .filter({ hasText: style })
      .click();
    await page.waitForFunction(
      (style) =>
        document
          .querySelector('.studio-style-option[aria-pressed="true"]')
          ?.textContent.includes(style),
      style,
    );
    assert.ok(
      (await page.locator(".studio-document-area").innerText()).includes(
        summary,
      ),
    );
  }
  await page.getByRole("button", { name: "Make Creative my default" }).click();
  await page.getByRole("button", { name: "Refine", exact: true }).click();
  await noOverflow();
  await page.screenshot({
    path: `${output}/studio-desktop.png`,
    fullPage: true,
    animations: "disabled",
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download plain text" }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "Jamie_Lee_CV.txt");
  await download.saveAs(`${output}/cv.txt`);
  await page.evaluate(() => {
    window.__printCalls = 0;
    const original = document.createElement.bind(document);
    document.createElement = function (name, options) {
      const element = original(name, options);
      if (name.toLowerCase() === "iframe")
        element.addEventListener("load", () => {
          element.contentWindow.print = () => {
            window.__printCalls++;
          };
        });
      return element;
    };
  });
  await page.getByRole("button", { name: "Print / save PDF" }).click();
  await page.waitForFunction(() => window.__printCalls === 1);
  console.log(
    "PASS: four CV styles preserve content, text download, shared HTML print invocation",
  );

  await page
    .getByRole("button", { name: "Open settings", exact: true })
    .click();
  await visible(page.getByRole("dialog", { name: "Manage your account." }));
  assert.equal(
    await page.evaluate(() =>
      document.querySelector("dialog").contains(document.activeElement),
    ),
    true,
  );
  await page.getByRole("button", { name: "Pause briefs", exact: true }).click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .first()
    .click();
  await page.keyboard.press("Escape");
  await visible(page.getByText("Briefs paused", { exact: true }));
  await page
    .getByRole("button", { name: "Search commands", exact: true })
    .click();
  await visible(page.getByRole("dialog"));
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Mark applied", exact: true }).click();
  await visible(
    page.getByRole("heading", { name: "Every application. A next step." }),
  );
  await page.getByLabel("Follow-up plan", { exact: true }).selectOption("7");
  await visible(page.getByText("Review follow-up draft", { exact: true }));
  await page.getByLabel("Follow-up plan", { exact: true }).selectOption("off");
  assert.equal(
    await page.getByText("Review follow-up draft", { exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Open materials", exact: true })
    .click();
  await visible(page.getByRole("tab", { name: "CV", exact: true }));
  console.log(
    "PASS: modal settings, pause state, commands, applied tracking, follow-up and reopen",
  );

  await openState("brief");
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  await page.getByRole("button", { name: "I manage my own", exact: true }).click();
  await page.getByRole("button", { name: "Save settings", exact: true }).first().click();
  await page.keyboard.press("Escape");
  await page.locator(".real-role .selection-control").first().click();
  await page.getByRole("button", { name: "Review selected roles", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Your materials. Your process.", exact: true }));
  assert.equal(await page.getByRole("tab", { name: "CV", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Mark applied", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Every application. A next step." }));
  console.log("PASS: self-managed selection opens tracking and can be marked applied without AI document generation");

  await openState("onboarding");
  await page.getByLabel("Import your CV", { exact: true }).setInputFiles({
    name: "sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Fictional CV"),
  });
  await visible(
    page.getByText("CV import is disabled in this local preview.", {
      exact: false,
    }),
  );
  await page.getByRole("button", { name: "Set your preferences" }).click();
  await visible(page.getByRole("heading", { name: "Define your next move." }));
  const moveCriteria = page.getByLabel("What would make a move worth it?", {
    exact: true,
  });
  await visible(moveCriteria);
  await moveCriteria.fill("");
  await moveCriteria.pressSequentially("climate mission, 4-day week", {
    delay: 12,
  });
  assert.equal(await moveCriteria.inputValue(), "climate mission, 4-day week");
  await visible(
    page.getByText("climate mission / 4-day week", { exact: true }),
  );
  await page.getByRole("button", { name: "Choose delivery" }).click();
  await visible(page.getByRole("heading", { name: "Find your search rhythm." }));
  const choices = (label) => page.getByRole("button", { name: new RegExp(`^${label}`) });
  await visible(page.getByText("Up to 3 standout matches", { exact: true }));
  assert.equal(await choices("5 possibilities").count(), 0);
  assert.equal(await choices("Daily").getAttribute("aria-pressed"), "true");
  await choices("Three times a week").click();
  await choices("Daily").click();
  const deliveryTime = await page.getByLabel("Daily email time", { exact: true }).inputValue();
  await page.screenshot({ path: `${output}/onboarding-delivery-desktop.png`, fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Finish setup", exact: true }).click();
  await visible(page.getByRole("button", { name: "Find my first roles now" }));
  await page.getByRole("button", { name: "Adjust delivery" }).click();
  await visible(page.getByRole("dialog"));
  await visible(page.getByText("Up to 3 standout matches", { exact: true }));
  assert.equal(await choices("5 possibilities").count(), 0);
  assert.equal(await choices("Daily").getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByLabel("Daily email time", { exact: true }).inputValue(), deliveryTime);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Find my first roles now" }).click();
  await visible(page.locator(".real-role").first());
  assert.equal(await page.locator(".real-role").count(), 3);
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  await choices("Three times a week").click();
  await page.getByRole("button", { name: "Save settings", exact: true }).first().click();
  await visible(page.getByText(/Preferences saved/));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open settings", exact: true }).click();
  assert.equal(await choices("5 possibilities").count(), 0);
  assert.equal(await choices("Three times a week").getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: `${output}/brief-settings-desktop.png`, fullPage: true, animations: "disabled" });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".real-role").count(), 3, "Saving delivery settings must not rewrite an already delivered brief");
  console.log(
    "PASS: three-step onboarding, delivery settings, brief arrival, safe preview upload",
  );

  await page.clock.install({ time: new Date() });
  await openState("brief");
  await page.locator(".real-role .selection-control").first().click();
  await page.clock.fastForward(JOB_RETENTION_MS + 1000);
  await visible(page.getByRole("heading", { name: "No current suggestions in this brief." }));
  assert.equal(await page.locator(".real-role").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Prepare my materials", exact: true }).isDisabled(), true);
  await visible(page.getByText("A selected suggestion expired. Choose from the current roles.", { exact: true }));
  await page.getByText(/^Expired suggestions/).click();
  await visible(page.getByText(/Suggestion expired/).first());
  await openState("studio");
  await page.clock.fastForward(JOB_RETENTION_MS + 1000);
  await visible(page.getByRole("tab", { name: "CV", exact: true }));
  await page.getByText(/^Saved documents/).click();
  await visible(page.getByText("Generated documents are kept separately from seven-day suggestions.", { exact: true }));
  const savedDocuments = page.getByRole("group", { name: "Saved application documents" });
  await savedDocuments.getByRole("button").nth(1).click();
  await page.waitForFunction(() => document.querySelector("#active-role-select")?.value === "2");
  await visible(page.getByRole("tab", { name: "CV", exact: true }));
  await page.getByRole("button", { name: "Mark applied", exact: true }).click();
  await visible(page.getByRole("heading", { name: "Every application. A next step." }));
  await page.getByRole("button", { name: "Open materials", exact: true }).click();
  await visible(page.getByRole("tab", { name: "CV", exact: true }));
  await page.clock.setSystemTime(new Date());
  console.log("PASS: selected-job expiry disables preparation; saved documents and applied history remain accessible after seven days");

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/dashboard",
    ...["onboarding", "waiting", "brief", "studio"].map(
      (state) => `/design-preview?state=${state}`,
    ),
  ]) {
    await page.goto(`${base}${path}`);
    if (path.startsWith("/design-preview"))
      await visible(page.locator(".workspace-shell"));
    if (path.endsWith("state=onboarding")) {
      await page.getByRole("navigation", { name: "Setup steps" }).getByRole("button").nth(2).click();
      await visible(page.getByText("Up to 3 standout matches", { exact: true }));
    }
    await noOverflow();
    await page.screenshot({
      path: `${output}/${path === "/" ? "homepage" : path.replace(/[^a-z]+/g, "-")}-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page
    .getByRole("navigation", { name: "Mobile workspace navigation" })
    .getByRole("button", { name: "Applications" })
    .click();
  await visible(
    page.getByRole("heading", { name: "Every application. A next step." }),
  );
  assert.deepEqual(apiCalls, [], "Design preview must not call live APIs");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS: all six mobile layouts, mobile navigation, zero preview API calls or browser errors",
  );
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
}
