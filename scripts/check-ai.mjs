import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
function modules(overrides = {}) {
  const cache = new Map();
  function load(name) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = resolve(root, `${name.slice(2)}.ts`);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), { fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const unit = { exports: {} }; cache.set(name, unit);
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(load, unit, unit.exports);
    return unit.exports;
  }
  return load;
}

const names = ["ANTHROPIC_API_KEY", "DATABASE_URL", "AI_ENABLED", "AI_USER_DAILY_CENTS", "AI_GLOBAL_DAILY_CENTS",
  "ANTHROPIC_MODEL", "ANTHROPIC_MATCH_MODEL", "ANTHROPIC_INTENT_MODEL", "ANTHROPIC_MATERIALS_MODEL", "ANTHROPIC_FOLLOW_UP_MODEL"];
const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
const originalFetch = global.fetch;
const cache = new Map(), leases = new Map(), reservations = [], requests = [], logs = [];
let allowBudget = true, failStorage = false;
const keyFor = (user, key) => `${user}:${key}`;
const db = {
  async readAiCache(user, key) { if (failStorage) throw Error("private database detail"); return cache.get(keyFor(user, key)); },
  async claimAiCache(user, key, token) {
    const id = keyFor(user, key);
    if (leases.has(id) || cache.get(id)?.fresh) return false;
    leases.set(id, token); return true;
  },
  async writeAiCache(user, key, token, text, ttl) {
    const id = keyFor(user, key);
    if (leases.get(id) === token) cache.set(id, { text, ttl, fresh: true });
  },
  async releaseAiCache(user, key, token) { const id = keyFor(user, key); if (leases.get(id) === token) leases.delete(id); },
  async reserveAiBudget(user, cents, userLimit, globalLimit) {
    if (!allowBudget || cents > userLimit || cents > globalLimit) return false;
    reservations.push({ user, cents }); return true;
  },
};
const real = modules({ "@/lib/db": db, "@/lib/logger": { logger: Object.fromEntries(["info", "warn", "error"].map((key) => [key, (...args) => logs.push(args)])) } });
const ai = real("@/lib/hunteragent-ai");
const matching = real("@/lib/hunteragent-matching");
const data = real("@/lib/hunteragent-data");
let handler = () => ({ ok: true });
let stopReason = "end_turn";
function reset() { cache.clear(); leases.clear(); reservations.length = requests.length = logs.length = 0; allowBudget = true; failStorage = false; stopReason = "end_turn"; }
let checks = 0;
function pass(text) { checks++; console.log(`PASS: ${text}`); }
try {
  for (const name of names) delete process.env[name];
  process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
  process.env.DATABASE_URL = "postgres://test.invalid/mock";
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    assert.ok(options.signal instanceof AbortSignal);
    const result = await handler(body);
    return new Response(JSON.stringify({ stop_reason: stopReason, content: [{ type: "text", text: JSON.stringify(result) }] }), { status: 200 });
  };
  assert.equal(ai.aiTaskSettings("matching").model, "claude-haiku-4-5-20251001");
  assert.equal(ai.aiTaskSettings("followUp").model, "claude-haiku-4-5-20251001");
  assert.equal(ai.aiTaskSettings("materials").model, "claude-sonnet-5");
  assert.equal(ai.aiTaskSettings("intent").model, "claude-sonnet-5");
  process.env.ANTHROPIC_MODEL = "claude-sonnet-4-6";
  assert.equal(ai.aiTaskSettings("materials").model, "claude-sonnet-4-6");
  assert.equal(ai.aiTaskSettings("followUp").model, "claude-haiku-4-5-20251001");
  delete process.env.ANTHROPIC_MODEL;
  assert.deepEqual(ai.aiBudgetLimits(), { userDailyCents: 100, globalDailyCents: 1000 });
  for (const value of ["invalid", "", "-1", "1.5", "Infinity"]) {
    process.env.AI_USER_DAILY_CENTS = value; assert.equal(ai.aiBudgetLimits().userDailyCents, 0);
  }
  delete process.env.AI_USER_DAILY_CENTS;
  pass("task-specific defaults, legacy override stays materials-only, fail-closed budget configuration");

  const call = (prompt = "test", userId = "u1", validate) => ai.callTaskAi("matching", "system", prompt, { userId, validate });
  assert.equal(await call(), '{"ok":true}');
  assert.equal(await call(), '{"ok":true}');
  assert.equal(requests.length, 1); assert.equal(reservations.length, 1);
  assert.equal(requests[0].thinking.type, "disabled");
  assert.equal(requests[0].max_tokens, ai.aiTaskSettings("matching").output);
  assert.ok(reservations[0].cents >= 2);
  await call("test", "u2"); assert.equal(requests.length, 2);
  await call("changed", "u1"); assert.equal(requests.length, 3);
  pass("same-user cache reuse, private cross-user isolation, changed-input invalidation, bounded output and thinking");

  reset();
  assert.equal(await call("test", ""), null);
  delete process.env.DATABASE_URL; assert.equal(await call(), null); process.env.DATABASE_URL = "postgres://test.invalid/mock";
  process.env.AI_ENABLED = "false"; assert.equal(await call(), null); delete process.env.AI_ENABLED;
  failStorage = true; assert.equal(await call(), null); failStorage = false;
  assert.equal(await call("x".repeat(30000)), null);
  process.env.ANTHROPIC_MATCH_MODEL = "unpriced-model"; assert.equal(await call(), null); delete process.env.ANTHROPIC_MATCH_MODEL;
  assert.equal(requests.length, 0); assert.equal(reservations.length, 0);
  pass("missing identity/database, kill switch, storage outage, oversized input and unknown model make zero paid calls");

  reset(); allowBudget = false;
  assert.equal(await call(), null); assert.equal(await call(), null);
  assert.equal(requests.length, 0);
  reset(); handler = () => { throw Error("secret private upstream error"); };
  assert.equal(await call(), null); assert.equal(await call(), null);
  assert.equal(requests.length, 1); assert.equal(reservations.length, 1);
  assert.ok(!JSON.stringify(logs).includes("secret"));
  pass("budget refusal stops calls; ambiguous provider failures retain reservations, negative-cache, never leak upstream details");

  reset(); handler = () => ({ wrong: true });
  assert.equal(await call("bad-json", "u1", (raw) => Boolean(ai.parseAiJson(raw)?.ok)), null);
  assert.equal(await call("bad-json", "u1", (raw) => Boolean(ai.parseAiJson(raw)?.ok)), null);
  assert.equal(requests.length, 1);
  reset(); handler = () => ({ ok: true }); stopReason = "max_tokens";
  assert.equal(await call(), null);
  pass("invalid schema and truncated/refused generation do not become usable cached output");

  reset(); let finish;
  handler = () => new Promise((resolve) => { finish = resolve; });
  const pending = call("simultaneous");
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(await call("simultaneous"), null);
  finish({ ok: true }); await pending;
  assert.equal(requests.length, 1); assert.equal(reservations.length, 1);
  pass("concurrent identical requests have one lease and one paid call");

  reset();
  const profile = structuredClone(data.initialProfile);
  Object.assign(profile, { name: "Private Name", recipientEmail: "private@example.test", cvFile: "private-cv.pdf", currentTitle: "Product Designer", targetRoles: ["Product Designer"], specialPreferences: ["ocean conservation"], coreStrength: "Design systems" });
  const base = { ...data.DAILY_ROLES[0], title: "Product Designer", company: "Ocean Lab", location: "Remote", employment: "Full-time", summary: "Design systems for ocean conservation. Monthly overseas travel required." };
  const roles = [{ ...base, id: 101 }, { ...base, id: 102 }];
  const response = { roles: roles.map((role) => ({ id: role.id, score: role.id === 102 ? 94 : 30,
    matches: [{ preference: "ocean conservation", evidence: "Design systems for ocean conservation" }], concerns: ["Monthly overseas travel required"] })) };
  assert.ok(matching.validateMatchResponse(JSON.stringify(response), roles, profile));
  for (const mutate of [
    (r) => { r.roles[0].id = 999; }, (r) => { r.roles[0].id = 102; },
    (r) => { r.roles[0].matches[0].evidence = "Visa sponsorship guaranteed"; },
    (r) => { r.roles[0].matches[0].preference = "Become a billionaire"; },
    (r) => { r.roles[0].score = 500; }, (r) => { r.roles.pop(); },
    (r) => { r.roles[0].concerns = ["No paid vacation"]; },
  ]) { const altered = structuredClone(response); mutate(altered); assert.equal(matching.validateMatchResponse(JSON.stringify(altered), roles, profile), false); }
  pass("matching rejects fabricated IDs, duplicates, missing candidates, unsupported evidence/preferences/concerns and invalid scores");

  handler = (body) => body.model === "claude-sonnet-5" ? { preferences: [{ theme: "purpose", quote: "ocean conservation" }] } : response;
  const ranked = await matching.prioritizeRoles(roles, profile, "u1");
  assert.equal(ranked[0].id, 102); assert.equal(requests.length, 2);
  assert.match(ranked[0].fit, /Monthly overseas travel required/);
  assert.match(ranked[0].fit, /Confirm pay, location and work eligibility/);
  const sent = JSON.stringify(requests);
  for (const secret of [profile.name, profile.recipientEmail, profile.cvFile]) assert.ok(!sent.includes(secret));
  await matching.prioritizeRoles(ranked, profile, "u1"); assert.equal(requests.length, 2);
  process.env.AI_ENABLED = "false";
  const invalidated = await matching.prioritizeRoles(ranked, { ...profile, specialPreferences: ["No travel"] }, "u1");
  assert.ok(invalidated.every((role) => !role.matchAssessment), "Changed preferences invalidate old assessment even when AI is disabled");
  assert.ok(invalidated.every((role) => !role.fit.includes("Your priority")));
  delete process.env.AI_ENABLED;
  const changed = { ...profile, coreStrength: "Inclusive product design" };
  await matching.prioritizeRoles(ranked, changed, "u1"); assert.equal(requests.length, 3, "Intent unchanged: only Haiku re-runs");
  pass("one bounded Haiku batch, higher fit first, explicit tradeoffs, no identity/CV disclosure, stored assessments and cached Sonnet intent reused");

  reset(); handler = () => ({ roles: [] });
  const fallback = await matching.prioritizeRoles(roles, profile, "u1");
  assert.deepEqual(fallback.map((role) => role.id), roles.map((role) => role.id));
  assert.ok(fallback.every((role) => !role.matchAssessment));
  pass("malformed model output safely preserves deterministic candidate ordering");

  reset(); handler = (body) => body.model.startsWith("claude-haiku") ? { draft: "Hi Ocean Lab team, following up on my application." } : { cvSummary: "Product Designer", cvBullets: ["Fact one", "Fact two", "Fact three"], letter: "Application letter", reasoning: "Supplied facts", workSampleSelections: [] };
  const writing = real("@/lib/hunteragent-anthropic");
  const pack = await writing.generateApplicationPack(base, profile, "balanced", "minimal", { userId: "u1" });
  assert.equal(pack.provider, "anthropic");
  const followUp = await writing.generateFollowUpDraft(base, profile, "1 Sep 2026", "u1");
  assert.equal(followUp.provider, "anthropic");
  assert.equal(requests[0].model, "claude-sonnet-5"); assert.equal(requests[1].model, "claude-haiku-4-5-20251001");
  allowBudget = false;
  const preserved = await writing.generateApplicationPack(base, profile, "balanced", "minimal", { userId: "u1", target: "cv", instruction: "new instruction", currentPack: pack });
  assert.equal(preserved.provider, "fallback"); assert.equal(preserved.cvSummary, pack.cvSummary); assert.equal(preserved.letter, pack.letter);
  const template = real("@/lib/hunteragent-fallback").buildFallbackPack({ ...base, focus: [] }, profile, "balanced", "minimal");
  assert.ok(!JSON.stringify(template).includes("undefined")); assert.match(template.reasoning, /not an AI-tailored/);
  pass("real writing functions use correct models; exhausted budget preserves documents; empty-focus templates contain no fabricated tailoring");

  reset();
  const discovery = real("@/lib/hunteragent-discovery");
  const now = new Date();
  const sourced = roles.map((role) => ({ ...role, sourceUrl: `https://boards.greenhouse.io/ocean/jobs/${role.id}`,
    firstSeenAt: now.toISOString(), expiresAt: new Date(+now + 7 * 86400000).toISOString() }));
  const integrated = modules({ "@/lib/db": db, "@/lib/hunteragent-ai": ai,
    "@/lib/hunteragent-discovery": { ...discovery, discoverRoles: async () => ({ roles: sourced, lastDiscoveryAt: now.toISOString(), status: "cached" }) },
    "@/lib/agentmail": { sendDailyBriefEmail: () => { throw Error("No actual email in test"); } } });
  handler = (body) => body.model === "claude-sonnet-5" ? { preferences: [{ theme: "purpose", quote: "ocean conservation" }] } : response;
  const state = data.createInitialWorkspaceState();
  state.profile = { ...profile, jobsPerBrief: 3, workplaceModes: [], remoteRegions: [], workTypes: [] };
  const prepared = await integrated("@/lib/hunteragent-briefs").prepareFreshBrief(state, { userId: "u1", now });
  assert.deepEqual(prepared.brief.roleIds, [102], "Real brief assembly keeps AI ranking, rejects low fit, and does not pad to three");
  assert.deepEqual(state.discoveryPool.map((role) => role.id), [101]);
  assert.equal(state.roleCatalog[0].matchAssessment.score, 94);
  pass("brief integration preserves AI order, grounded assessment, low-fit exclusion and no-padding behavior");

  reset();
  const many = Array.from({ length: 20 }, (_, index) => ({ ...base, id: 200 + index }));
  handler = (body) => body.model === "claude-sonnet-5" ? { preferences: [{ theme: "purpose", quote: "ocean conservation" }] }
    : { roles: JSON.parse(body.messages[0].content).roles.map((role) => ({ id: role.id, score: 80,
      matches: [{ preference: "ocean conservation", evidence: "Design systems for ocean conservation" }], concerns: [] })) };
  const firstBatch = await matching.prioritizeRoles(many, { ...profile, jobsPerBrief: 3 }, "u1");
  assert.equal(JSON.parse(requests[1].messages[0].content).roles.length, 12);
  assert.equal(firstBatch.filter((role) => role.matchAssessment).length, 12);
  await matching.prioritizeRoles(firstBatch.slice(3), { ...profile, jobsPerBrief: 3 }, "u1");
  assert.equal(requests.length, 2, "Enough cached good matches means no unnecessary rerank of overflow");
  pass("at most twelve candidates per paid batch; enough cached matches avoid extra daily AI spending");

  console.log(`\n${checks} AI routing/matching checks passed with mocked providers; no paid calls or credentials used.`);
} finally {
  global.fetch = originalFetch;
  for (const [name, value] of Object.entries(original)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
}
