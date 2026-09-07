import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const DAY = 86_400_000;
const START = Date.parse("2026-03-26T08:00:00.000Z");
let clock = START;
let sequence = 0;
class FakeDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}

// Execute actual modules with a fake clock and isolated services, without a new dependency.
function modules(overrides = {}) {
  const cache = new Map();
  function load(name) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = resolve(root, `${name.slice(2)}.ts`);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const unit = { exports: {} };
    cache.set(name, unit);
    vm.runInThisContext(`(function(require,module,exports,Date,crypto){${output}\n})`, { filename })(
      load, unit, unit.exports, FakeDate, { randomUUID: () => `test-${++sequence}` },
    );
    return unit.exports;
  }
  return load;
}

let modelCalls = 0;
const fakeModel = {
  generateApplicationPack: async () => {
    modelCalls++;
    return { provider: "fallback", cvSummary: "Saved summary", cvBullets: ["Evidence"], letter: "Saved letter", reasoning: "Evidence", workSampleSelections: [] };
  },
};
const real = modules({ "@/lib/hunteragent-anthropic": fakeModel });
const data = real("@/lib/hunteragent-data");
const retention = real("@/lib/hunteragent-retention");
const ops = real("@/lib/hunteragent-workspace-ops");
const iso = (ms) => new Date(ms).toISOString();

function workspace() {
  const state = data.createInitialWorkspaceState();
  state.onboardingComplete = true;
  state.profile.recipientEmail = "candidate@example.test";
  state.roleCatalog = structuredClone(data.DAILY_ROLES).slice(0, 5).map((role) => ({ ...role, firstSeenAt: iso(START), expiresAt: iso(START + 7 * DAY), fingerprint: `job-${role.id}` }));
  const brief = data.createBriefRecord("now", state.roleCatalog, 5, new Date(START));
  Object.assign(brief, { sentAt: iso(START), status: "sent", outboundThreadId: "old-thread", outboundMessageId: "old-message", outboundInboxId: "inbox", recipientEmail: state.profile.recipientEmail });
  state.briefs = [brief];
  state.activeBriefId = brief.id;
  state.flowPhase = "brief";
  return state;
}

function savePack(state, roleId = 1) {
  const pack = { id: `saved-${roleId}`, roleId, briefId: state.briefs[0].id, generatedAt: iso(START + DAY), provider: "fallback", tone: "balanced", resumeStyleUsed: "modern", resumeSourceType: "upload", cvSummary: "Original saved CV", cvBullets: ["Do not delete"], letter: "Original letter", reasoning: "Original reasoning", workSampleSelections: [], followUpDraft: "Keep this follow-up" };
  state.packs.push(pack);
  return pack;
}

let passed = 0;
async function test(name, run) {
  clock = START;
  await run();
  passed++;
  console.log(`PASS: ${name}`);
}

await test("profile defaults and strict count/cadence normalization", () => {
  assert.equal(data.initialProfile.jobsPerBrief, 3);
  assert.equal(data.initialProfile.discoveryCadence, "daily");
  for (const value of [undefined, null, false, 0, 4, 10, "3", "5", [], {}, Infinity, NaN]) {
    assert.deepEqual(retention.normalizeBriefPreferences({ jobsPerBrief: value, discoveryCadence: value, explorationMode: value }), { jobsPerBrief: 3, discoveryCadence: "daily", explorationMode: "stretch" });
  }
  assert.deepEqual(retention.normalizeBriefPreferences({ jobsPerBrief: 3, discoveryCadence: "daily", explorationMode: "close" }), { jobsPerBrief: 3, discoveryCadence: "daily", explorationMode: "close" });
  assert.equal(data.createBriefRecord("now", data.DAILY_ROLES, 3).roleIds.length, 3);
  assert.equal(data.createBriefRecord("now", data.DAILY_ROLES, 10).roleIds.length, 3);
});

await test("seven elapsed days: millisecond before, exact boundary, after, including DST", () => {
  for (const offset of [-1, 0, 1]) {
    const state = workspace();
    clock = START + 7 * DAY + offset;
    retention.pruneExpiredSuggestions(state);
    assert.equal(state.briefs.length, offset < 0 ? 1 : 0);
    assert.equal(state.roleCatalog.length, offset < 0 ? 5 : 0);
    if (offset >= 0) {
      assert.equal(state.activeBriefId, null);
      assert.equal(state.expiredBriefs[0].outboundThreadId, "old-thread");
      assert.ok(!("roleIds" in state.expiredBriefs[0]));
      assert.ok(!("inboundRecords" in state.expiredBriefs[0]));
    }
  }
});

await test("selected jobs still expire; no processing state or catalog resurrection", () => {
  const state = workspace();
  const brief = state.briefs[0];
  clock = START + 7 * DAY - 1;
  ops.applyInboundReplyToWorkspace(state, { briefId: brief.id, rawText: "1, 2", source: "dashboard" });
  assert.deepEqual(brief.selectedRoleIds, [1, 2]);
  assert.equal(state.roleCatalog[0].firstSeenAt, iso(START));
  state.flowPhase = "processing";
  clock++;
  retention.pruneExpiredSuggestions(state);
  assert.deepEqual(brief.selectedRoleIds, []);
  assert.equal(state.activeRoleId, null);
  assert.notEqual(state.flowPhase, "processing");
  assert.equal(state.generationStatus, null);
  retention.pruneExpiredSuggestions(state);
  assert.equal(state.briefs.length, 0);
  assert.equal(state.roleCatalog.length, 0);
});

await test("partial expiry never remaps original numeric positions, including after serialization", () => {
  let state = workspace();
  state.roleCatalog[0].firstSeenAt = iso(START - DAY);
  clock = START + 6 * DAY;
  retention.pruneExpiredSuggestions(state);
  assert.deepEqual(state.briefs[0].roleIds, [2, 3]);
  assert.deepEqual(state.briefs[0].replyRoleIds, [1, 2, 3]);
  state = JSON.parse(JSON.stringify(state));
  let result = ops.applyInboundReplyToWorkspace(state, { briefId: state.briefs[0].id, rawText: "1", source: "webhook" });
  assert.deepEqual(result.selectedRoleIds, []);
  assert.match(state.lastError, /expired/);
  result = ops.applyInboundReplyToWorkspace(state, { briefId: state.briefs[0].id, rawText: "2", source: "webhook" });
  assert.deepEqual(result.selectedRoleIds, [2]);
  result = ops.applyInboundReplyToWorkspace(state, { briefId: state.briefs[0].id, rawText: "1, 3", source: "webhook" });
  assert.deepEqual(result.selectedRoleIds, []);
  assert.deepEqual(state.briefs[0].selectedRoleIds, [2]);
});

await test("saved documents and applied jobs survive outside expired suggestion selections", () => {
  const state = workspace();
  const pack = savePack(state);
  const packBefore = structuredClone(pack);
  const applied = { roleId: 2, briefId: state.briefs[0].id, appliedAt: iso(START + DAY), followUp: "7", followUpDueAt: iso(START + 8 * DAY), followUpDraft: "Keep applied draft", provider: "fallback", resumeStyleUsed: "modern" };
  state.appliedRecords.push(applied);
  state.briefs[0].selectedRoleIds = [1, 2, 3];
  clock = START + 20 * DAY;
  retention.pruneExpiredSuggestions(state);
  assert.deepEqual(state.packs[0], packBefore);
  assert.deepEqual(state.appliedRecords, [applied]);
  assert.deepEqual(state.roleCatalog.map((role) => role.id), [1, 2]);
  assert.deepEqual(state.briefs[0].roleIds, [2]);
  assert.deepEqual(state.briefs[0].selectedRoleIds, []);
  assert.deepEqual(state.briefs[0].topRoleIds, []);
  assert.equal(retention.canUseRole(state, 1, pack.briefId), true);
  assert.equal(retention.canUseRole(state, 3, pack.briefId), false);
});

await test("archived packs reopen and edit, while stale or unrelated generation makes zero calls", async () => {
  const state = workspace();
  const pack = savePack(state);
  const briefId = pack.briefId;
  state.briefs[0].selectedRoleIds = [1, 2];
  clock = START + 8 * DAY;
  retention.pruneExpiredSuggestions(state);
  assert.equal(state.briefs.length, 0);
  assert.deepEqual(retention.getRetainedBrief(state, briefId).roleIds, []);
  let calls = modelCalls;
  await ops.generateSelectedPacksForWorkspace(state, { briefId, roleId: 2 });
  assert.equal(modelCalls, calls);
  await ops.generateSelectedPacksForWorkspace(state, { briefId: "unknown", roleId: 1 });
  assert.equal(modelCalls, calls);
  await ops.generateSelectedPacksForWorkspace(state, { briefId, roleId: 1, target: "cv", intent: "edit", instruction: "Polish" });
  assert.equal(modelCalls, calls + 1);
  assert.equal(state.activeBriefId, briefId);
  assert.equal(state.flowPhase, "studio");
  assert.equal(state.packs[0].followUpDraft, pack.followUpDraft);
});

await test("expired and unmatched routing cannot target a newer brief", () => {
  const state = workspace();
  const oldId = state.briefs[0].id;
  clock = START + 7 * DAY;
  retention.pruneExpiredSuggestions(state);
  const fresh = { ...data.DAILY_ROLES[0], id: 101, firstSeenAt: iso(clock), fingerprint: "new-job" };
  state.roleCatalog.push(fresh);
  const brief = data.createBriefRecord("now", [fresh]);
  Object.assign(brief, { sentAt: iso(clock), status: "sent", outboundThreadId: "new-thread", outboundMessageId: "new-message", outboundInboxId: "inbox" });
  state.briefs.push(brief);
  state.activeBriefId = brief.id;
  for (const metadata of [{ briefId: oldId }, { briefId: "unknown" }, { threadId: "old-thread" }, { threadId: "unknown", inboxId: "inbox" }, { replyToMessageId: "unknown" }, { briefId: brief.id, threadId: "old-thread" }, { inboxId: "inbox" }]) {
    const result = ops.applyInboundReplyToWorkspace(state, { ...metadata, rawText: "1", source: "webhook" });
    assert.equal(result.briefId, null);
    assert.deepEqual(brief.selectedRoleIds, []);
    assert.equal(state.activeBriefId, brief.id);
  }
  const result = ops.applyInboundReplyToWorkspace(state, { threadId: "new-thread", messageId: "incoming-message", inboxId: "inbox", rawText: "1", source: "webhook" });
  assert.deepEqual(result.selectedRoleIds, [101]);
  assert.equal(state.flowPhase, "brief");
  assert.equal(brief.status, "replied");
  const duplicate = ops.applyInboundReplyToWorkspace(state, { threadId: "new-thread", messageId: "incoming-message", inboxId: "inbox", rawText: "1", source: "webhook" });
  assert.equal(duplicate.duplicate, true);
  assert.equal(brief.inboundRecords.length, 1);
});

await test("legacy first appearance, invalid dates, retained catalog, and immutable sent snapshots", () => {
  const state = workspace();
  for (const role of state.roleCatalog) { delete role.firstSeenAt; role.expiresAt = "invalid"; }
  clock = START + 6 * DAY;
  retention.pruneExpiredSuggestions(state);
  assert.equal(state.roleCatalog[0].firstSeenAt, iso(START));
  const prior = structuredClone(state);
  savePack(state);
  state.roleCatalog = [];
  state.briefs[0].replyRoleIds = [5, 4, 3, 2, 1];
  clock = START + 8 * DAY;
  retention.pruneExpiredSuggestions(state, new Date(clock), prior);
  assert.deepEqual(state.roleCatalog.map((role) => role.id), [1]);
  assert.equal(state.roleCatalog[0].firstSeenAt, iso(START));
  assert.equal(state.expiredBriefs[0].id, prior.briefs[0].id);
  const same = workspace();
  same.briefs[0].replyRoleIds = [5, 4, 3, 2, 1];
  retention.pruneExpiredSuggestions(same, new Date(START), { ...prior, briefs: [{ ...prior.briefs[0], id: same.briefs[0].id }] });
  assert.deepEqual(same.briefs[0].replyRoleIds, [1, 2, 3]);
});

await test("first actual send can replace unsent numbering; subsequent writes cannot", () => {
  const before = workspace();
  before.briefs[0].sentAt = null;
  const sent = structuredClone(before);
  Object.assign(sent.briefs[0], { roleIds: [2, 3, 4], replyRoleIds: [2, 3, 4], sentAt: iso(START + DAY) });
  retention.pruneExpiredSuggestions(sent, new Date(START + DAY), before);
  assert.deepEqual(sent.briefs[0].replyRoleIds, [2, 3, 4]);
  const after = structuredClone(sent);
  after.briefs[0].replyRoleIds = [4, 3];
  retention.pruneExpiredSuggestions(after, new Date(START + DAY), sent);
  assert.deepEqual(after.briefs[0].replyRoleIds, [2, 3, 4]);
  clock = START + DAY;
  assert.deepEqual(ops.applyInboundReplyToWorkspace(after, { briefId: after.activeBriefId, rawText: "1", source: "webhook" }).selectedRoleIds, [2]);
});

await test("earlier explicit and previous expiry are never extended by normalization", () => {
  const state = workspace();
  state.roleCatalog[0].expiresAt = iso(START + 2 * DAY);
  retention.pruneExpiredSuggestions(state);
  assert.equal(state.roleCatalog[0].expiresAt, iso(START + 2 * DAY));
  const before = structuredClone(state);
  state.roleCatalog[0].firstSeenAt = iso(START + DAY);
  state.roleCatalog[0].expiresAt = iso(START + 30 * DAY);
  retention.pruneExpiredSuggestions(state, new Date(START + DAY), before);
  assert.equal(state.roleCatalog[0].firstSeenAt, iso(START));
  assert.equal(state.roleCatalog[0].expiresAt, iso(START + 2 * DAY));
  clock = START + 2 * DAY;
  assert.equal(retention.isRoleExpired(state.roleCatalog[0]), true);
  retention.pruneExpiredSuggestions(state);
  assert.deepEqual(state.briefs[0].roleIds, [2, 3]);
});

await test("expired archived packs refine without relying on empty brief selections", async () => {
  const state = workspace();
  const pack = savePack(state);
  state.activeRoleId = pack.roleId;
  clock = START + 8 * DAY;
  retention.pruneExpiredSuggestions(state);
  const calls = modelCalls;
  await ops.generateSelectedPacksForWorkspace(state, { briefId: pack.briefId, intent: "edit", target: "letter", instruction: "Polish" });
  assert.equal(modelCalls, calls + 1);
  assert.equal(state.packs.length, 1);
  assert.equal(state.activeRoleId, 1);
  assert.equal(state.flowPhase, "studio");
});

await test("jobs expiring during a batch are not sent for new generation", async () => {
  const state = workspace();
  state.briefs[0].selectedRoleIds = [1, 2];
  state.activeRoleId = 1;
  let calls = 0;
  const slow = modules({ "@/lib/hunteragent-anthropic": {
    generateApplicationPack: async () => { calls++; clock = START + 7 * DAY; return fakeModel.generateApplicationPack(); },
  } })("@/lib/hunteragent-workspace-ops");
  clock = START + 7 * DAY - 1;
  await slow.generateSelectedPacksForWorkspace(state);
  assert.equal(calls, 1);
  assert.equal(state.packs.length, 1);
  assert.equal(state.packs[0].roleId, 1);
  assert.match(state.lastError, /expired/);
  assert.notEqual(state.flowPhase, "processing");
});

await test("discovery pool and seen fingerprint cannot refresh an expired job", () => {
  const state = workspace();
  state.discoveryPool = [{ ...state.roleCatalog[0], id: 77, firstSeenAt: iso(START + DAY), expiresAt: iso(START + 100 * DAY) }];
  state.seenJobs = { "job-1": iso(START) };
  state.lastDiscoveryAt = iso(START + DAY);
  clock = START + 7 * DAY;
  retention.pruneExpiredSuggestions(state);
  assert.deepEqual(state.discoveryPool, []);
  assert.deepEqual(state.seenJobs, { "job-1": iso(START) });
  assert.equal(state.lastDiscoveryAt, iso(START + DAY));
});

await test("invalid generation IDs, targets, and instructions never call a model", async () => {
  const state = workspace();
  state.briefs[0].selectedRoleIds = [1];
  const calls = modelCalls;
  for (const input of [null, [], { roleId: 0 }, { roleId: -1 }, { roleId: "1" }, { roleId: 1.5 }, { roleId: NaN }, { briefId: "" }, { briefId: null }, { target: "unknown" }, { intent: "unknown" }, { instruction: {} }, { instruction: "x".repeat(10_001) }]) {
    assert.equal(ops.isValidGenerationInput(input), false);
    await ops.generateSelectedPacksForWorkspace(state, input);
    assert.equal(modelCalls, calls);
    assert.notEqual(state.flowPhase, "processing");
  }
  await ops.generateSelectedPacksForWorkspace(state, { roleId: 999 });
  assert.equal(modelCalls, calls);
});

function fakeDatabase(initial) {
  let row = { user_id: "user", state_json: JSON.stringify(initial), updated_at: iso(START) };
  let conflict = null;
  let swaps = 0;
  let upserts = 0;
  let leaseToken = null;
  const db = {
    getWorkspaceRow: async () => structuredClone(row),
    ensureWorkspaceForUser: async () => structuredClone(row),
    listWorkspaceRows: async () => [structuredClone(row)],
    upsertWorkspaceRow: async (_id, json) => { upserts++; row.state_json = json; },
    compareAndSwapWorkspaceRow: async (_id, expected, next) => {
      swaps++;
      if (conflict) { row.state_json = JSON.stringify(conflict); conflict = null; }
      if (row.state_json !== expected) return false;
      row.state_json = next;
      return true;
    },
    claimWorkspaceUpdateLease: async (_id, token) => {
      if (leaseToken) return false;
      leaseToken = token;
      return true;
    },
    releaseWorkspaceUpdateLease: async (_id, token) => {
      if (leaseToken === token) leaseToken = null;
    },
  };
  return { db, concurrentWrite: (state) => { conflict = state; }, state: () => JSON.parse(row.state_json), counts: () => ({ swaps, upserts }) };
}

await test("database read/list migrations use CAS and preserve concurrent packs/settings", async () => {
  for (const list of [false, true]) {
    const legacy = workspace();
    delete legacy.profile.jobsPerBrief;
    delete legacy.profile.discoveryCadence;
    const database = fakeDatabase(legacy);
    const current = structuredClone(legacy);
    current.profile.name = "Concurrent name";
    current.profile.jobsPerBrief = 3;
    savePack(current);
    database.concurrentWrite(current);
    const store = modules({ "@/lib/db": database.db })("@/lib/hunteragent-store");
    const state = list ? (await store.listStoredWorkspaces())[0].state : await store.readWorkspaceState("user");
    assert.equal(state.profile.name, "Concurrent name");
    assert.equal(state.profile.jobsPerBrief, 3);
    assert.equal(state.packs.length, 1);
    assert.deepEqual(database.state(), state);
    assert.deepEqual(database.counts(), { swaps: 2, upserts: 0 });
  }
});

await test("undated legacy roles get one persisted anchor, not a new week on each read", async () => {
  const state = data.createInitialWorkspaceState();
  state.roleCatalog = structuredClone(data.DAILY_ROLES);
  const database = fakeDatabase(state);
  const store = modules({ "@/lib/db": database.db })("@/lib/hunteragent-store");
  await store.readWorkspaceState("user");
  assert.equal(database.state().roleCatalog[0].firstSeenAt, iso(START));
  clock = START + 7 * DAY;
  const expired = await store.readWorkspaceState("user");
  assert.deepEqual(expired.roleCatalog, []);
  assert.deepEqual((await store.readWorkspaceState("user")).roleCatalog, []);
  assert.equal(database.counts().upserts, 0);
});

await test("server writes restore retained role details and prune at the write clock", async () => {
  const state = workspace();
  savePack(state);
  const database = fakeDatabase(state);
  const store = modules({ "@/lib/db": database.db })("@/lib/hunteragent-store");
  const saved = await store.updateWorkspaceState((draft) => {
    clock = START + 7 * DAY;
    draft.roleCatalog = [];
    draft.profile.jobsPerBrief = 99;
    return draft;
  }, "user");
  assert.equal(saved.profile.jobsPerBrief, 3);
  assert.equal(saved.briefs.length, 0);
  assert.equal(saved.packs.length, 1);
  assert.deepEqual(saved.roleCatalog.map((role) => role.id), [1]);
});

await test("overlapping workspace updates are serialized without losing either change", async () => {
  const database = fakeDatabase(workspace());
  const store = modules({ "@/lib/db": database.db })("@/lib/hunteragent-store");
  let enterFirst;
  let releaseFirst;
  const firstEntered = new Promise((resolve) => { enterFirst = resolve; });
  const firstCanFinish = new Promise((resolve) => { releaseFirst = resolve; });

  const first = store.updateWorkspaceState(async (draft) => {
    draft.profile.name = "First update";
    enterFirst();
    await firstCanFinish;
    return draft;
  }, "user");
  await firstEntered;

  const second = store.updateWorkspaceState((draft) => {
    draft.profile.locations = "London";
    return draft;
  }, "user");
  releaseFirst();
  await Promise.all([first, second]);

  const persisted = database.state();
  assert.equal(persisted.profile.name, "First update");
  assert.equal(persisted.profile.locations, "London");
});

function api(state, event = null) {
  let discoveryCalls = 0;
  let sendCalls = 0;
  const load = modules({
    "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
    "@/lib/auth": { requireUser: async () => ({ id: "user" }), AuthError: class AuthError extends Error {} },
    "@/lib/logger": { logger: { info() {}, warn() {}, error() {}, debug() {} } },
    "@/lib/hunteragent-anthropic": fakeModel,
    "@/lib/agentmail": { buildScheduledBriefStatus: () => "Scheduled" },
    "@/lib/hunteragent-briefs": {
      prepareFreshBrief: async (draft, options) => {
        assert.equal(options.userId, "user");
        discoveryCalls++;
        draft.lastDiscoveryAt = iso(clock);
        draft.generationStatus = "No new matches are available. Discovery will retry on its next scheduled day.";
        return { brief: null };
      },
      sendPreparedBrief: async (draft) => { sendCalls++; return draft; },
    },
    "@/lib/hunteragent-store": {
      readWorkspaceState: async () => retention.pruneExpiredSuggestions(state),
      listStoredWorkspaces: async () => [{ userId: "user", state: retention.pruneExpiredSuggestions(state) }],
      updateWorkspaceState: async (update) => { retention.pruneExpiredSuggestions(state); state = await update(state); return retention.pruneExpiredSuggestions(state); },
    },
    "@/lib/agentmail-webhook": {
      verifyAgentMailWebhook: () => event,
      isAgentMailMessageReceived: () => true,
      getAgentMailReplyText: () => "2",
    },
  });
  const post = async (path, body) => load(`@/app/api/${path}/route`).POST(new Request(`http://test.local/api/${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" } }));
  post.counts = () => ({ discoveryCalls, sendCalls });
  return post;
}

await test("production defaults and onboarding with no results never invent curated jobs", async () => {
  assert.deepEqual(data.createInitialWorkspaceState().roleCatalog, []);
  assert.deepEqual(data.createBriefRecord("now").roleIds, []);
  for (const firstBrief of ["now", "scheduled"]) {
    const state = data.createInitialWorkspaceState();
    state.profile.recipientEmail = "candidate@example.test";
    state.profile.firstBrief = firstBrief;
    const post = api(state);
    const response = await post("workspace", { action: "finish_onboarding" });
    const result = await response.json();
    assert.equal(result.onboardingComplete, true);
    assert.deepEqual(result.roleCatalog, []);
    assert.deepEqual(result.briefs, []);
    assert.equal(result.activeBriefId, null);
    assert.match(result.generationStatus, /No new matches/);
    assert.equal(result.lastDiscoveryAt, iso(clock));
    assert.deepEqual(post.counts(), { discoveryCalls: 1, sendCalls: 0 });
  }
});

await test("first-brief action discovers from an empty account and returns fresh no-results state", async () => {
  const state = data.createInitialWorkspaceState();
  state.onboardingComplete = true;
  state.profile.recipientEmail = "candidate@example.test";
  const post = api(state);
  const response = await post("workspace", { action: "send_first_brief_now" });
  const result = await response.json();
  assert.equal(result.lastError, null);
  assert.deepEqual(result.roleCatalog, []);
  assert.deepEqual(result.briefs, []);
  assert.match(result.generationStatus, /No new matches/);
  assert.equal(result.lastDiscoveryAt, iso(clock));
  assert.deepEqual(post.counts(), { discoveryCalls: 1, sendCalls: 0 });
  const database = fakeDatabase(result);
  const store = modules({ "@/lib/db": database.db })("@/lib/hunteragent-store");
  assert.deepEqual((await store.readWorkspaceState("user")).briefs, []);
  assert.deepEqual((await store.readWorkspaceState("user")).roleCatalog, []);
});

await test("webhook numeric selection never generates and ends in brief, stale webhook has no newer brief fallback", async () => {
  const state = workspace();
  const event = { event_type: "message.received", event_id: "event-1", message: { thread_id: "old-thread", message_id: "incoming-2", inbox_id: "inbox", from: state.profile.recipientEmail } };
  const post = api(state, event);
  const calls = modelCalls;
  let response = await post("agentmail/webhook", {});
  assert.equal(response.status, 200);
  assert.equal(modelCalls, calls);
  assert.equal(state.flowPhase, "brief");
  assert.equal(state.briefs[0].status, "replied");
  assert.deepEqual(state.briefs[0].selectedRoleIds, [2]);
  clock = START + 7 * DAY;
  response = await post("agentmail/webhook", {});
  const reply = await response.json();
  assert.equal(reply.briefId, null);
  assert.equal(reply.ignored, true);
  assert.equal(modelCalls, calls);
});

await test("workspace actions reject expired suggestions but allow saved pack reopening and edits", async () => {
  const state = workspace();
  const pack = savePack(state);
  clock = START + 8 * DAY;
  const post = api(state);
  for (const action of [{ action: "set_active_role", roleId: 2 }, { action: "set_role_style", roleId: 2, style: "modern" }, { action: "set_prompt_draft", key: "2:cv", value: "Edit" }, { action: "mark_applied", roleId: 2 }]) {
    const response = await post("workspace", action);
    assert.match((await response.json()).lastError, /expired/);
  }
  let response = await post("workspace", { action: "set_active_brief", briefId: pack.briefId });
  let result = await response.json();
  assert.equal(result.activeRoleId, 1);
  assert.equal(result.activeBriefId, pack.briefId);
  assert.equal(result.flowPhase, "studio");
  assert.equal(result.briefs.length, 0);
  response = await post("workspace", { action: "set_role_style", roleId: 1, style: "executive" });
  assert.equal((await response.json()).roleStyleOverrides["1"], "executive");
  response = await post("workspace", { action: "set_prompt_draft", key: "1:cv", value: "Polish" });
  assert.equal((await response.json()).promptDrafts["1:cv"], "Polish");
});

await test("server normalizes onboarding/settings and rejects malformed actions/replies/generation", async () => {
  const state = workspace();
  const post = api(state);
  for (const action of ["sync_draft", "update_profile"]) {
    let response = await post("workspace", { action, onboardingStep: 2, profile: { jobsPerBrief: 3, discoveryCadence: "daily" } });
    let result = await response.json();
    assert.equal(result.profile.jobsPerBrief, 3);
    assert.equal(result.profile.discoveryCadence, "daily");
    response = await post("workspace", { action, onboardingStep: 2, profile: { jobsPerBrief: "3", discoveryCadence: "hourly" } });
    result = await response.json();
    assert.equal(result.profile.jobsPerBrief, 3);
    assert.equal(result.profile.discoveryCadence, "daily");
  }
  for (const [path, body] of [["workspace", null], ["workspace", { action: "set_active_role", roleId: "1" }], ["workspace", { action: "update_profile", profile: null }], ["inbound-email", { briefId: state.activeBriefId, rawText: 1 }], ["generate-packs", { roleId: "1" }], ["generate-packs", "not-json"], ["follow-up", { roleId: 1, plan: "99" }]]) {
    assert.equal((await post(path, body)).status, 400);
  }
});

console.log(`\n${passed} deterministic retention checks passed; no external services or secrets used.`);
