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
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const unit = { exports: {} };
    cache.set(name, unit);
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(load, unit, unit.exports);
    return unit.exports;
  }
  return load;
}

// Fake PostgreSQL and clock; exercise the real parameterized DB functions, not
// an alternate in-memory implementation of the discovery service.
function backend(clock) {
  const cache = new Map(), usage = new Map(), runs = new Map(), workspaces = new Map();
  let tail = Promise.resolve(), inTransaction = false, locked = false, reservations = 0;
  const day = () => clock.now.toISOString().slice(0, 10);
  const used = (scope) => usage.get(`${day()}:${scope}`) ?? 0;
  async function sql(strings, ...values) {
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    if (query.startsWith("SELECT pg_advisory_xact_lock")) { assert.ok(inTransaction); locked = true; return []; }
    if (query.startsWith("SELECT scope, credits")) {
      assert.ok(inTransaction && locked, "budget read must be inside globally locked transaction");
      return ["global", values[0]].map((scope) => ({ scope, credits: used(scope) }));
    }
    if (query.startsWith("INSERT INTO discovery_credit_usage")) {
      assert.ok(inTransaction && locked, "both budget writes must be in the same locked transaction");
      const [credits, scope, userCredits] = values;
      assert.equal(credits, userCredits);
      usage.set(`${day()}:global`, used("global") + credits);
      usage.set(`${day()}:${scope}`, used(scope) + credits);
      reservations++;
      return [];
    }
    if (query.startsWith("SELECT results")) {
      const row = cache.get(values[0]);
      return row ? [{ results: structuredClone(row.results), fresh: row.expiry > +clock.now }] : [];
    }
    if (query.startsWith("INSERT INTO discovery_search_cache")) {
      const [key, token] = values, existing = cache.get(key);
      if (existing && (existing.expiry > +clock.now || existing.lease > +clock.now)) return [];
      cache.set(key, { results: existing?.results ?? [], expiry: existing?.expiry ?? 0, token, lease: +clock.now + 60000 });
      return [{ cache_key: key }];
    }
    if (query.startsWith("UPDATE discovery_search_cache SET results")) {
      const [results, ttl, key, token] = values, row = cache.get(key);
      if (row?.token === token && row.lease > +clock.now) Object.assign(row, { results: JSON.parse(results), expiry: +clock.now + ttl * 1000, token: null, lease: 0 });
      return [];
    }
    if (query.startsWith("UPDATE discovery_search_cache SET lease_until")) {
      const [key, token] = values, row = cache.get(key);
      if (row?.token === token) Object.assign(row, { token: null, lease: 0 });
      return [];
    }
    if (query.startsWith("INSERT INTO discovery_user_runs")) {
      const [userId, timezone, , daily] = values;
      const localDate = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
      const dow = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(clock.now);
      const last = runs.get(userId);
      if (last && (localDate(last) >= localDate(clock.now) || (!daily && !["Mon", "Wed", "Fri"].includes(dow)))) return [];
      runs.set(userId, new Date(clock.now));
      return [{ started_at: clock.now.toISOString() }];
    }
    if (query.startsWith("UPDATE workspaces SET state_json")) {
      const [next, updated, id, original] = values;
      if (workspaces.get(id)?.state_json !== original) return [];
      workspaces.set(id, { state_json: next, updated_at: updated });
      return [{ user_id: id }];
    }
    if (query.startsWith("DELETE FROM discovery_")) return [];
    throw new Error(`Unmocked query: ${query}`);
  }
  sql.begin = async (callback) => {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    inTransaction = true; locked = false;
    try { return await callback(sql); } finally { inTransaction = false; locked = false; release(); }
  };
  return { sql, cache, usage, runs, workspaces, used, get reservations() { return reservations; } };
}

const originalFetch = global.fetch;
const originalPg = global.__hunteragentPg, originalInit = global.__hunteragentDbInit;
const envNames = ["DATABASE_URL", "TAVILY_API_KEY", "AGENTMAIL_API_KEY", "AGENTMAIL_INBOX_ID", "DISCOVERY_USER_DAILY_CREDITS", "DISCOVERY_GLOBAL_DAILY_CREDITS", "DISCOVERY_CACHE_TTL_SECONDS", "DISCOVERY_ENABLE_ADVANCED"];
const environment = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
let assertions = 0;
function pass(label) { assertions++; console.log(`PASS: ${label}`); }
const clock = { now: new Date("2026-09-07T08:00:00Z") };
let store;
function resetBackend() {
  store = backend(clock);
  global.__hunteragentPg = store.sql;
  global.__hunteragentDbInit = Promise.resolve();
  process.env.DATABASE_URL = "postgres://mock/mock";
  process.env.TAVILY_API_KEY = "mock-key-never-sent";
  process.env.AGENTMAIL_API_KEY = "mock-mail";
  process.env.AGENTMAIL_INBOX_ID = "mock-inbox";
  for (const name of envNames.filter((name) => name.startsWith("DISCOVERY_"))) delete process.env[name];
}
function fixture(id) {
  return { title: `Frontend Engineer - Acme ${id}`, url: `https://boards.greenhouse.io/acme/jobs/${id}`,
    content: `Full-time Frontend Engineer. Location: London. Build accessible web products with a collaborative engineering team at Acme ${id}.` };
}
try {
  resetBackend();
  const load = modules();
  const db = load("@/lib/db");
  const cache = load("@/lib/hunteragent-search-cache");
  const discovery = load("@/lib/hunteragent-discovery");
  const schedule = load("@/lib/hunteragent-scheduling");
  const data = load("@/lib/hunteragent-data");
  const briefs = load("@/lib/hunteragent-briefs");
  const mail = load("@/lib/agentmail");
  const retention = load("@/lib/hunteragent-retention");
  const schemaStatements = [];
  global.__hunteragentPg = async (strings) => {
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    schemaStatements.push(query);
    if (query.startsWith("SELECT COUNT")) return [{ count: "1" }];
    return [];
  };
  global.__hunteragentDbInit = undefined;
  await db.readDiscoveryCache("schema-check");
  for (const table of ["discovery_search_cache", "discovery_credit_usage", "discovery_user_runs"]) {
    assert.ok(schemaStatements.some((query) => query.startsWith(`CREATE TABLE IF NOT EXISTS ${table} `)));
    assert.ok(schemaStatements.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`), `${table} must deny PostgREST roles by default`);
    assert.ok(!schemaStatements.some((query) => query.startsWith("CREATE POLICY") && query.includes(table)));
  }
  assert.ok(schemaStatements.some((query) => query.includes("PRIMARY KEY (scope, credit_day)")));
  assert.ok(schemaStatements.some((query) => query.includes("credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0)")));
  assert.ok(schemaStatements.some((query) => query.includes("results JSONB NOT NULL DEFAULT '[]'::jsonb")));
  const coreTableAlterations = schemaStatements.filter((query) => /^ALTER TABLE (users|sessions|workspaces) /.test(query));
  assert.deepEqual(coreTableAlterations, [
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT",
    "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE sessions ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY",
  ]);
  resetBackend();
  pass("real schema initialization creates private RLS-protected discovery tables and safe budget/cache defaults without public policies");
  function workspace() {
    const state = data.createInitialWorkspaceState();
    state.roleCatalog = []; state.briefs = []; state.discoveryPool = []; state.seenJobs = {};
    state.onboardingComplete = true;
    Object.assign(state.profile, { targetRoles: ["Frontend Engineer"], locations: "London", name: "Private Person",
      recipientEmail: "private@example.test", coreStrength: "Secret CV evidence", specialPreferences: ["Private accessibility preference"],
      jobsPerBrief: 3, discoveryCadence: "three-per-week", briefsPaused: false, timezone: "Europe/London", briefTime: "09:00" });
    return state;
  }
  const profile = workspace().profile;
  let calls = [];
  let items = Array.from({ length: 15 }, (_, i) => fixture(i + 100));
  global.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ results: items }) }; };

  assert.equal(discovery.jobsPerBrief({}), 3);
  assert.deepEqual(discovery.buildPublicQueries(profile), ['"frontend engineer" jobs london']);
  assert.ok(!discovery.buildPublicQueries(profile).join().includes("Private"));
  assert.equal(cache.publicQueryCacheKey(" Frontend  London ", "basic"), cache.publicQueryCacheKey("frontend london", "basic"));
  assert.notEqual(cache.publicQueryCacheKey("frontend london", "basic"), cache.publicQueryCacheKey("frontend london", "advanced"));
  assert.equal(cache.canonicalJobUrl("https://job-boards.greenhouse.io/acme/jobs/123?utm_source=test#apply"), "https://boards.greenhouse.io/acme/jobs/123");
  for (const url of ["https://boards.greenhouse.io/acme", "https://example.com/jobs/1", "javascript:alert(1)", "https://jobs.lever.co/acme"]) assert.equal(cache.canonicalJobUrl(url), null);
  pass("broad public queries, isolated cache keys, canonical job URLs and no identity/preferences in shared queries");

  let result = await cache.searchPublicJobs("frontend london", "basic", { userId: "a", allowPaid: true, now: clock.now });
  assert.equal(result.status, "live"); assert.equal(result.results.length, 15); assert.equal(store.used("global"), 1);
  assert.equal(calls[0].body.search_depth, "basic"); assert.equal(calls[0].body.auto_parameters, false); assert.equal(calls[0].body.include_raw_content, false);
  const separateInstance = modules()("@/lib/hunteragent-search-cache");
  await separateInstance.searchPublicJobs("FRONTEND  LONDON", "basic", { userId: "b", allowPaid: true, now: clock.now });
  assert.equal(calls.length, 1); assert.equal(store.used("user:b"), 0);
  assert.deepEqual(Object.keys(result.results[0]).sort(), ["content", "firstSeenAt", "title", "url"]);
  clock.now = new Date(+clock.now + 86400000);
  result = await cache.searchPublicJobs("frontend london", "basic", { userId: "b", allowPaid: true, now: clock.now });
  assert.equal(calls.length, 2); assert.equal(result.results[0].firstSeenAt, "2026-09-07T08:00:00.000Z");
  pass("persisted cross-instance cache reuse, TTL refresh and immutable first-seen time");

  resetBackend(); calls = [];
  const attempts = await Promise.all(Array.from({ length: 80 }, (_, i) => db.reserveDiscoveryCredits(`u${i % 10}`, 1, 4, 17)));
  assert.equal(attempts.filter(Boolean).length, 17); assert.equal(store.used("global"), 17);
  for (let i = 0; i < 10; i++) assert.ok(store.used(`user:u${i}`) <= 4);
  assert.equal(await db.reserveDiscoveryCredits("u", 2, 4, 18), false);
  assert.equal(store.used("user:u"), 0); assert.equal(store.used("global"), 17);
  clock.now = new Date(+clock.now + 86400000);
  assert.equal(await db.reserveDiscoveryCredits("u", 2, 2, 2), true);
  assert.equal(await db.reserveDiscoveryCredits("u", 1, 2, 5), false);
  pass("atomic global AND per-user budgets, no partial charge on rejection, advanced two-credit cost and UTC reset");

  resetBackend(); calls = [];
  let finish;
  global.fetch = async () => { calls.push(1); await new Promise((resolve) => { finish = resolve; }); return { ok: true, json: async () => ({ results: [fixture(700)] }) }; };
  const leader = cache.searchPublicJobs("stampede", "basic", { userId: "a", allowPaid: true, now: clock.now });
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
  const contenders = await Promise.all(Array.from({ length: 20 }, () => separateInstance.searchPublicJobs("stampede", "basic", { userId: "b", allowPaid: true, now: clock.now })));
  assert.ok(contenders.every((item) => item.status === "busy")); assert.equal(calls.length, 1);
  finish(); await leader;
  assert.equal(await db.claimDiscoveryCache(cache.publicQueryCacheKey("stampede", "basic"), "late-owner"), false);
  assert.equal(store.used("global"), 1);
  pass("stampede lease, cross-instance contention, and atomic late-claimer freshness guard");

  let charged = false;
  const rechecked = modules({ "@/lib/db": {
    readDiscoveryCache: (() => { let reads = 0; return async () => ++reads === 1 ? null : { fresh: true, results: [] }; })(),
    claimDiscoveryCache: async () => true, releaseDiscoveryCache: async () => {},
    reserveDiscoveryCredits: async () => { charged = true; return true; },
  } })("@/lib/hunteragent-search-cache");
  assert.equal((await rechecked.searchPublicJobs("race", "basic", { userId: "a", allowPaid: true, now: clock.now })).status, "cached");
  assert.equal(charged, false);
  pass("explicit post-claim freshness recheck occurs before reserving credits");

  resetBackend(); calls = [];
  global.fetch = async () => { calls.push(1); throw new Error("provider timeout"); };
  assert.equal((await cache.searchPublicJobs("failure", "basic", { userId: "a", allowPaid: true, now: clock.now })).status, "error");
  await cache.searchPublicJobs("failure", "basic", { userId: "b", allowPaid: true, now: clock.now });
  assert.equal(calls.length, 1); assert.equal(store.used("global"), 1);
  delete process.env.TAVILY_API_KEY;
  await cache.searchPublicJobs("missing provider", "basic", { userId: "a", allowPaid: true, now: clock.now });
  process.env.TAVILY_API_KEY = "mock"; delete process.env.DATABASE_URL;
  await cache.searchPublicJobs("missing db", "basic", { userId: "a", allowPaid: true, now: clock.now });
  process.env.DATABASE_URL = "postgres://mock/mock";
  await cache.searchPublicJobs("missing user", "basic", { allowPaid: true, now: clock.now });
  assert.equal(calls.length, 1);
  const failedDb = modules({ "@/lib/db": { readDiscoveryCache: async () => { throw new Error("DB down"); } } })("@/lib/hunteragent-search-cache");
  assert.equal((await failedDb.searchPublicJobs("db down", "basic", { userId: "a", allowPaid: true })).status, "error");
  process.env.DISCOVERY_GLOBAL_DAILY_CREDITS = "invalid";
  assert.equal(cache.discoveryLimits().globalCredits, 0);
  pass("outages/missing configuration/missing identity fail closed, failure cache, no unsafe credit refunds");

  clock.now = new Date("2026-09-07T08:00:00Z"); resetBackend(); calls = [];
  items = Array.from({ length: 15 }, (_, i) => fixture(i + 100));
  global.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ results: items, message_id: "email-id" }) }; };
  const state = workspace(3);
  let prepared = await briefs.prepareFreshBrief(state, { userId: "daily-user", now: clock.now });
  assert.equal(prepared.roles.length, 3); assert.equal(prepared.brief.roleIds.length, 3); assert.equal(state.discoveryPool.length, 12);
  assert.ok(prepared.roles.every((role) => role.sourceUrl && role.fingerprint && role.posted === "Posting date not provided by source"));
  const firstIds = [...prepared.brief.roleIds];
  await briefs.prepareFreshBrief(state, { userId: "daily-user", now: clock.now });
  assert.equal(calls.length, 1); assert.equal(state.briefs.length, 1);
  await briefs.sendPreparedBrief(state, prepared.brief.id, clock.now);
  assert.equal(calls.at(-1).body.subject, "Your 3 matched roles for today");
  assert.match(calls.at(-1).body.text, /3 new roles/);
  assert.doesNotMatch(calls.at(-1).body.text, /10 roles|BrightPath|Hollow Arc/);
  const afterEmail = calls.length;
  await briefs.sendPreparedBrief(state, prepared.brief.id, clock.now); assert.equal(calls.length, afterEmail);
  clock.now = new Date("2026-09-08T08:00:00Z");
  prepared = await briefs.prepareFreshBrief(state, { userId: "daily-user", now: clock.now });
  assert.equal(prepared.roles.length, 3); assert.equal(calls.length, afterEmail);
  assert.ok(prepared.brief.roleIds.every((id) => !firstIds.includes(id)));
  assert.ok(state.roleCatalog.some((role) => role.id === firstIds[0]));
  pass("three-job brief/email counts, pending reuse, no resend, unseen pool delivery on off-days and ignored-role suppression");

  resetBackend(); calls = []; clock.now = new Date("2026-09-09T08:00:00Z");
  for (const n of [3, 2, 1, 0]) {
    resetBackend(); calls = []; items = Array.from({ length: n }, (_, i) => fixture(1000 + i));
    const sparse = workspace();
    const fresh = await briefs.prepareFreshBrief(sparse, { userId: `sparse-${n}`, now: clock.now });
    assert.equal(fresh.roles.length, n);
    assert.equal(fresh.brief?.roleIds.length ?? 0, n);
    assert.ok(calls.length <= 2, "one basic query plus at most one advanced escalation");
    if (n < 3) assert.equal(calls[1].body.search_depth, "advanced");
    if (n) {
      const email = mail.buildBriefEmail(fresh.brief, sparse.profile, sparse.roleCatalog, clock.now);
      assert.equal(email.count, n); assert.match(email.subject, new RegExp(`Your ${n} matched role`));
      if (n === 1) assert.equal(email.subject, "Your 1 matched role for today");
    } else {
      assert.equal(fresh.brief, null); assert.equal(sparse.briefs.length, 0); assert.equal(sparse.roleCatalog.length, 0);
      const before = calls.length;
      await briefs.sendPreparedBrief(sparse, undefined, clock.now); assert.equal(calls.length, before);
    }
  }
  pass("fixed three-job briefs, sparse two/one/zero results, accurate singular/plural and zero fabricated/padded/empty email results");

  const monday = new Date("2026-09-07T08:00:00Z"), tuesday = new Date("2026-09-08T08:00:00Z"), wednesday = new Date("2026-09-09T08:00:00Z");
  assert.equal(schedule.shouldDiscoverNow(profile, null, tuesday), true);
  assert.equal(schedule.shouldDiscoverNow(profile, monday.toISOString(), tuesday), false);
  assert.equal(schedule.shouldDiscoverNow(profile, monday.toISOString(), wednesday), true);
  assert.equal(schedule.shouldDiscoverNow(profile, wednesday.toISOString(), wednesday), false);
  assert.equal(schedule.shouldDiscoverNow({ ...profile, discoveryCadence: "daily" }, monday.toISOString(), tuesday), true);
  assert.equal(schedule.shouldDiscoverNow({ ...profile, briefsPaused: true }, null, monday), false);
  assert.equal(schedule.shouldRunBriefNow(profile, tuesday), true);
  resetBackend(); clock.now = monday;
  assert.ok(await db.claimDiscoveryRun("stale-user", "Europe/London", false));
  assert.equal(await db.claimDiscoveryRun("stale-user", "Europe/London", false), null);
  clock.now = tuesday; assert.equal(await db.claimDiscoveryRun("stale-user", "Europe/London", false), null);
  clock.now = wednesday; assert.ok(await db.claimDiscoveryRun("stale-user", "Europe/London", false));
  pass("initial search any day, Monday/Wednesday/Friday cadence, daily opt-in, separate daily delivery and persisted stale-snapshot guards");

  resetBackend(); calls = []; items = [fixture(400), { ...fixture(400), url: `${fixture(400).url}?utm_source=another` },
    { title: "Frontend Engineer", url: "https://boards.greenhouse.io/acme", content: "Browse all engineering jobs" },
    { ...fixture(401), content: "This position is closed and no longer accepting applications" }];
  const deduped = await discovery.discoverRoles(profile, { userId: "dedupe", now: clock.now });
  assert.equal(deduped.roles.length, 1);
  const same = await modules()("@/lib/hunteragent-discovery").discoverRoles(profile, { userId: "dedupe2", now: clock.now });
  assert.equal(same.roles[0].id, deduped.roles[0].id);
  assert.ok(Number.isSafeInteger(same.roles[0].id));
  const duplicateSeen = await discovery.discoverRoles(profile, { userId: "dedupe3", now: clock.now, seenJobs: { [same.roles[0].fingerprint]: clock.now.toISOString() } });
  assert.equal(duplicateSeen.roles.length, 0);
  const oldRole = { ...same.roles[0], firstSeenAt: new Date(+clock.now - 7 * 86400000).toISOString(), expiresAt: new Date(+clock.now + 86400000).toISOString() };
  assert.equal(discovery.roleIsCurrent(oldRole, clock.now), false);
  assert.equal(discovery.rankUnseenRoles([oldRole], profile, {}, clock.now).length, 0);
  pass("canonical URL deduplication, stable cross-instance IDs, listing-only/closed-job filtering and hard first-seen expiry");

  const retainState = workspace();
  const current = same.roles[0];
  retainState.roleCatalog = [oldRole, { ...current, id: current.id + 1, sourceUrl: fixture(999).url, fingerprint: discovery.roleFingerprint(fixture(999).url) }];
  const preserved = data.createBriefRecord("now", retainState.roleCatalog, 5, clock.now);
  retainState.briefs = [preserved]; retainState.activeBriefId = preserved.id;
  retainState.packs = [{ roleId: oldRole.id, briefId: preserved.id, generatedAt: oldRole.firstSeenAt, cvSummary: "Saved document must survive" }];
  retainState.discoveryPool = [oldRole];
  retention.pruneExpiredSuggestions(retainState, clock.now);
  assert.equal(retainState.discoveryPool.length, 0);
  assert.ok(retainState.roleCatalog.some((role) => role.id === oldRole.id));
  assert.equal(retainState.packs[0].cvSummary, "Saved document must survive");
  assert.deepEqual(preserved.replyRoleIds, [oldRole.id, current.id + 1]);
  const positionEmail = mail.buildBriefEmail(preserved, retainState.profile, retainState.roleCatalog, clock.now);
  assert.equal(positionEmail.count, 1); assert.match(positionEmail.text, /\n2\. Frontend Engineer/); assert.doesNotMatch(positionEmail.text, /\n1\. Frontend Engineer/);
  pass("pool expiry, saved-document preservation and immutable original numeric reply positions after partial expiry");

  // An unsent brief can shrink before its first send; only the final delivered
  // positions are immutable, not its earlier dashboard preview positions.
  const preSend = workspace(3);
  preSend.roleCatalog = [oldRole, ...[991, 992, 993, 994].map((id) => ({ ...current, id,
    sourceUrl: fixture(id).url, fingerprint: discovery.roleFingerprint(fixture(id).url) }))];
  const toSend = data.createBriefRecord("now", preSend.roleCatalog, 3, clock.now);
  preSend.briefs = [toSend]; preSend.activeBriefId = toSend.id;
  await briefs.sendPreparedBrief(preSend, toSend.id, clock.now);
  assert.deepEqual(toSend.roleIds, [991, 992]);
  assert.deepEqual(toSend.replyRoleIds, [991, 992]);
  assert.match(calls.at(-1).body.text, /\n1\. Frontend Engineer/);
  assert.equal(calls.at(-1).body.subject, "Your 2 matched roles for today");
  const expiredAfterSend = preSend.roleCatalog.find((role) => role.id === 991);
  expiredAfterSend.firstSeenAt = oldRole.firstSeenAt;
  retention.pruneExpiredSuggestions(preSend, clock.now);
  assert.deepEqual(toSend.replyRoleIds, [991, 992]);
  const afterExpiry = mail.buildBriefEmail(toSend, preSend.profile, preSend.roleCatalog, clock.now);
  assert.match(afterExpiry.text, /\n2\. Frontend Engineer/);
  assert.doesNotMatch(afterExpiry.text, /\n1\. Frontend Engineer/);
  pass("first send finalizes contiguous positions after expiry/count changes; later expiry never renumbers delivered positions");

  const paused = workspace(); paused.profile.briefsPaused = true;
  const beforePaused = calls.length;
  assert.equal((await briefs.prepareFreshBrief(paused, { userId: "paused", now: clock.now })).brief, null);
  assert.equal((await discovery.discoverRoles(paused.profile, { userId: "paused", now: clock.now })).roles.length, 0);
  assert.equal(calls.length, beforePaused);
  await assert.rejects(() => mail.sendDailyBriefEmail({ roleIds: [] }, profile, [], clock.now), /empty brief/);
  pass("paused means no search and email backend rejects empty content");

  store.workspaces.set("cas", { state_json: "original" });
  assert.equal(await db.compareAndSwapWorkspaceRow("cas", "original", "normalized", clock.now.toISOString()), true);
  assert.equal(await db.compareAndSwapWorkspaceRow("cas", "original", "stale overwrite", clock.now.toISOString()), false);
  assert.equal(store.workspaces.get("cas").state_json, "normalized");
  pass("read-time migration compare-and-swap cannot clobber a newer workspace");

  let sent = 0, updates = 0, preparations = 0;
  const snapshots = ["incomplete", "paused", "sent", "not-due", "changed", "empty"].map((userId) => {
    const state = workspace();
    state.generationStatus = "Preserve user-facing status";
    if (userId === "incomplete") state.onboardingComplete = false;
    if (userId === "paused") state.profile.briefsPaused = true;
    if (userId === "sent") state.briefs = [{ sentAt: clock.now.toISOString() }];
    if (userId === "not-due") state.profile.briefTime = "21:00";
    return { userId, state };
  });
  const run = modules({
    "@/lib/db": { pruneDiscoveryStorage: async () => {} },
    "@/lib/hunteragent-store": { listStoredWorkspaces: async () => snapshots,
      updateWorkspaceState: async (callback, userId) => {
        updates++;
        const latest = structuredClone(snapshots.find((item) => item.userId === userId).state);
        if (userId === "changed") latest.profile.briefsPaused = true;
        return callback(latest);
      } },
    "@/lib/hunteragent-briefs": { prepareFreshBrief: async (_state, options) => {
      preparations++; assert.equal(options.userId, "empty"); assert.equal(options.now, clock.now); return { brief: null };
    }, sendPreparedBrief: async () => { sent++; } },
  })("@/lib/run-daily-briefs");
  const scheduled = await run.runDailyBriefs(clock.now);
  assert.equal(sent, 0); assert.equal(updates, 2); assert.equal(preparations, 1);
  assert.equal(scheduled.results.length, 6);
  assert.ok(scheduled.results.slice(0, 5).every((result) => result.status.startsWith("Skipped:")));
  assert.ok(snapshots.every(({ state }) => state.generationStatus === "Preserve user-facing status"));
  pass("scheduler skips no-op writes, preserves status, rechecks only due users, passes identity/clock and never sends an empty brief");
  console.log(`\n${assertions} discovery checks passed. All provider/DB/email calls were mocked.`);
} finally {
  global.fetch = originalFetch;
  global.__hunteragentPg = originalPg;
  global.__hunteragentDbInit = originalInit;
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
