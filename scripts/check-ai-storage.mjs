import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
function loadDatabase() {
  const filename = resolve(root, "lib/db.ts");
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const unit = { exports: {} };
  const load = (name) => name === "@/lib/hunteragent-data" ? { createInitialWorkspaceState: () => ({}) } : require(name);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(load, unit, unit.exports);
  return unit.exports;
}

const DAY = 86400000;
const keyFor = (userId, key) => JSON.stringify([userId, key]);
const dayFor = (date) => date.toISOString().slice(0, 10);

// Run the real SQL-tagged functions against an isolated, parameter-aware mock.
// Transactions serialize and stage both counters, including rollback and an
// ambiguous commit. No network, external DB, or AI provider is used.
function fakeDatabase(clock) {
  const cache = new Map(), users = new Set(), statements = [];
  let usage = new Map(), staged, transactionDay, locked = false, tail = Promise.resolve();
  let fail = null, counterOverride = null, reservations = 0;
  const centsUsed = (scope, date = clock.now) => usage.get(`${dayFor(date)}:${scope}`) ?? 0;
  const count = (scope) => (staged ?? usage).get(`${transactionDay ?? dayFor(clock.now)}:${scope}`) ?? 0;
  async function sql(strings, ...values) {
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    statements.push({ query, values });
    if (fail === "query") throw new Error("Database unavailable");
    if (query.startsWith("CREATE ") || query.startsWith("ALTER ")) return [];
    if (query.startsWith("SELECT COUNT")) return [{ count: "1" }];
    if (query === "SELECT pg_advisory_xact_lock(724186032)") {
      assert.ok(staged, "lock must be transaction-scoped"); locked = true; return [];
    }
    if (query.startsWith("SELECT scope, cents::text AS cents FROM ai_budget_usage")) {
      assert.ok(staged && locked, "both cap reads must be inside the global lock");
      assert.match(query, /budget_day = \(now\(\) AT TIME ZONE 'UTC'\)::date/);
      if (fail === "read") throw new Error("Budget read unavailable");
      return counterOverride ?? ["global", values[0]].map((scope) => ({ scope, cents: String(count(scope)) }));
    }
    if (query.startsWith("INSERT INTO ai_budget_usage")) {
      assert.ok(staged && locked, "both reservations must be inside the same lock");
      assert.match(query, /ON CONFLICT \(scope, budget_day\) DO UPDATE/);
      const [cents, scope, userCents] = values;
      assert.equal(cents, userCents);
      staged.set(`${transactionDay}:global`, count("global") + cents);
      if (fail === "write") throw new Error("Write failed before second counter");
      staged.set(`${transactionDay}:${scope}`, count(scope) + cents);
      reservations++;
      return [];
    }
    if (query.startsWith("SELECT response_text AS text")) {
      assert.match(query, /WHERE user_id = \? AND cache_key = \?/);
      assert.match(query, /updated_at > now\(\) - interval '30 days'/);
      const row = cache.get(keyFor(...values));
      return row && row.updated > +clock.now - 30 * DAY ? [{ text: row.text, fresh: row.expires > +clock.now }] : [];
    }
    if (query.startsWith("INSERT INTO ai_response_cache")) {
      assert.match(query, /ON CONFLICT \(user_id, cache_key\) DO UPDATE/);
      assert.match(query, /expires_at <= now\(\).*lease_until <= now\(\)/);
      assert.match(query, /interval '120 seconds'/);
      const [userId, key, token] = values;
      if (!users.has(userId)) throw new Error("Foreign key violation");
      const identity = keyFor(userId, key), row = cache.get(identity);
      if (row && (row.expires > +clock.now || row.lease > +clock.now)) return [];
      cache.set(identity, { userId, text: null, expires: row?.expires ?? -Infinity, lease: +clock.now + 120000, token, updated: +clock.now });
      return [{ cache_key: key }];
    }
    if (query.startsWith("UPDATE ai_response_cache SET response_text")) {
      assert.match(query, /WHERE user_id = \? AND cache_key = \? AND lease_token = \? AND lease_until > now\(\)/);
      const [text, ttl, userId, key, token] = values, row = cache.get(keyFor(userId, key));
      if (row?.token === token && row.lease > +clock.now) {
        Object.assign(row, { text, expires: +clock.now + ttl * 1000, token: null, lease: -Infinity, updated: +clock.now });
      }
      return [];
    }
    if (query.startsWith("UPDATE ai_response_cache SET lease_token")) {
      assert.match(query, /WHERE user_id = \? AND cache_key = \? AND lease_token = \?/);
      const [userId, key, token] = values, row = cache.get(keyFor(userId, key));
      if (row?.token === token) Object.assign(row, { token: null, lease: -Infinity });
      return [];
    }
    if (query.startsWith("DELETE FROM ai_response_cache")) {
      assert.match(query, /updated_at <= now\(\) - interval '30 days'/);
      for (const [key, row] of cache) if (row.updated <= +clock.now - 30 * DAY) cache.delete(key);
      return [];
    }
    if (query.startsWith("DELETE FROM ai_budget_usage")) {
      assert.match(query, /budget_day < \(now\(\) AT TIME ZONE 'UTC'\)::date - 30/);
      const cutoff = dayFor(new Date(+clock.now - 30 * DAY));
      for (const key of usage.keys()) if (key.slice(0, 10) < cutoff) usage.delete(key);
      return [];
    }
    if (query.startsWith("DELETE FROM discovery_")) return [];
    if (query.startsWith("DELETE FROM password_reset_tokens older")) return [];
    if (query.startsWith("DELETE FROM auth_rate_limits")) return [];
    if (query.startsWith("DELETE FROM product_events")) {
      assert.match(query, /occurred_at <= now\(\) - interval '90 days'/);
      return [];
    }
    if (query.startsWith("DELETE FROM users")) {
      users.delete(values[0]);
      for (const [key, row] of cache) if (row.userId === values[0]) cache.delete(key);
      return [];
    }
    throw new Error(`Unexpected SQL: ${query}`);
  }
  sql.begin = async (callback) => {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    staged = new Map(usage); transactionDay = dayFor(clock.now); locked = false;
    try {
      const result = await callback(sql);
      if (fail === "commit") throw new Error("Commit failed");
      usage = staged;
      if (fail === "ambiguous") throw new Error("Commit succeeded but acknowledgement lost");
      return result;
    } finally {
      staged = undefined; transactionDay = undefined; locked = false; release();
    }
  };
  return { sql, cache, users, statements, centsUsed,
    get usage() { return usage; }, get reservations() { return reservations; },
    set fail(value) { fail = value; }, set counterOverride(value) { counterOverride = value; } };
}

const original = { pg: global.__hunteragentPg, init: global.__hunteragentDbInit, databaseUrl: process.env.DATABASE_URL, fetch: global.fetch };
const clock = { now: new Date("2026-09-07T23:59:59Z") };
let backend, checks = 0;
function setup() {
  backend = fakeDatabase(clock);
  for (const user of ["alice", "bob", "carol"]) backend.users.add(user);
  global.__hunteragentPg = backend.sql;
  global.__hunteragentDbInit = Promise.resolve();
  return backend;
}
function pass(label) { checks++; console.log(`PASS: ${label}`); }
try {
  // Any accidental provider request fails loudly rather than reaching the network.
  global.fetch = async () => { throw new Error("Network access is forbidden in storage tests"); };
  process.env.DATABASE_URL = "postgres://fake/fake";
  setup();
  const db = loadDatabase(), anotherInstance = loadDatabase();
  global.__hunteragentDbInit = undefined;
  assert.equal(await db.readAiCache("alice", "schema-probe"), null);
  const schema = backend.statements.map(({ query }) => query);
  const cacheSchema = schema.find((query) => query.startsWith("CREATE TABLE IF NOT EXISTS ai_response_cache "));
  const budgetSchema = schema.find((query) => query.startsWith("CREATE TABLE IF NOT EXISTS ai_budget_usage "));
  assert.match(cacheSchema, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(cacheSchema, /PRIMARY KEY \(user_id, cache_key\)/);
  assert.match(cacheSchema, /response_text TEXT/);
  assert.match(cacheSchema, /lease_until TIMESTAMPTZ NOT NULL DEFAULT '-infinity'/);
  assert.match(budgetSchema, /cents BIGINT NOT NULL DEFAULT 0 CHECK \(cents >= 0 AND cents <= 9007199254740991\)/);
  assert.match(budgetSchema, /PRIMARY KEY \(scope, budget_day\)/);
  for (const table of ["ai_response_cache", "ai_budget_usage"]) {
    assert.ok(schema.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.ok(!schema.some((query) => query.startsWith("CREATE POLICY") && query.includes(table)));
  }
  assert.ok(schema.includes("CREATE INDEX IF NOT EXISTS idx_ai_cache_updated_at ON ai_response_cache(updated_at)"));
  assert.ok(schema.includes("CREATE INDEX IF NOT EXISTS idx_ai_budget_day ON ai_budget_usage(budget_day)"));
  const coreTableAlterations = schema.filter((query) => /^ALTER TABLE (users|sessions|workspaces) /.test(query));
  assert.deepEqual(coreTableAlterations, [
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT",
    "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE sessions ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY",
  ]);
  pass("schema creates isolated user-FK/composite-key AI cache, bounded integer counters, indexes and RLS with no public policies");

  setup();
  assert.equal(await db.claimAiCache("alice", "same-prompt", "alice-owner"), true);
  assert.equal(await db.claimAiCache("bob", "same-prompt", "bob-owner"), true);
  await db.writeAiCache("alice", "same-prompt", "alice-owner", "Alice confidential CV", 300);
  await db.writeAiCache("bob", "same-prompt", "bob-owner", "Bob confidential CV", 300);
  assert.deepEqual(await db.readAiCache("alice", "same-prompt"), { text: "Alice confidential CV", fresh: true });
  assert.deepEqual(await anotherInstance.readAiCache("bob", "same-prompt"), { text: "Bob confidential CV", fresh: true });
  assert.equal(await db.readAiCache("carol", "same-prompt"), null);
  await db.writeAiCache("bob", "same-prompt", "alice-owner", "Cross-user overwrite", 300);
  assert.equal((await db.readAiCache("bob", "same-prompt")).text, "Bob confidential CV");
  assert.ok(!backend.statements.some(({ query }) => /discovery_search_cache/.test(query)));
  await assert.rejects(() => db.claimAiCache("nonexistent", "same-prompt", "owner"), /Foreign key/);
  pass("identical keys stay per-user, cached responses persist across instances, and no AI output uses shared public search storage");

  const attack = "prompt'; DROP TABLE users; --";
  assert.equal(await db.claimAiCache("alice", attack, "token';--"), true);
  await db.writeAiCache("alice", attack, "token';--", "Sensitive text ');--", 60);
  assert.equal((await db.readAiCache("alice", attack)).text, "Sensitive text ');--");
  assert.ok(backend.statements.some(({ values }) => values.includes(attack)));
  assert.ok(backend.statements.every(({ query }) => !query.includes(attack) && !query.includes("Sensitive text")));
  pass("cache keys, tokens and sensitive output remain SQL parameters, never interpolated SQL");

  setup();
  const claims = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? db : anotherInstance).claimAiCache("alice", "stampede", `owner-${i}`)));
  assert.equal(claims.filter(Boolean).length, 1);
  const row = backend.cache.get(keyFor("alice", "stampede"));
  assert.equal(row.lease, +clock.now + 120000);
  const owner = row.token;
  await db.releaseAiCache("bob", "stampede", owner);
  await db.releaseAiCache("alice", "stampede", "wrong-owner");
  assert.equal(row.token, owner);
  clock.now = new Date(+clock.now + 119999);
  assert.equal(await db.claimAiCache("alice", "stampede", "too-early"), false);
  clock.now = new Date(+clock.now + 1);
  await db.writeAiCache("alice", "stampede", owner, "Too late", 10);
  assert.equal(row.text, null);
  assert.equal(await anotherInstance.claimAiCache("alice", "stampede", "replacement"), true);
  await db.releaseAiCache("alice", "stampede", owner);
  await db.writeAiCache("alice", "stampede", owner, "Old writer", 10);
  await db.writeAiCache("alice", "stampede", "replacement", "Current writer", 10);
  assert.deepEqual(await db.readAiCache("alice", "stampede"), { text: "Current writer", fresh: true });
  assert.equal(await db.claimAiCache("alice", "stampede", "late-claimer"), false);
  clock.now = new Date(+clock.now + 10000);
  assert.deepEqual(await db.readAiCache("alice", "stampede"), { text: "Current writer", fresh: false });
  assert.equal(await db.claimAiCache("alice", "stampede", "after-ttl"), true);
  assert.equal((await db.readAiCache("alice", "stampede")).text, null);
  await db.releaseAiCache("alice", "stampede", "after-ttl");
  assert.equal(await db.claimAiCache("alice", "stampede", "after-release"), true);
  pass("120-second stampede lease, expired-owner fencing, stale-token release protection and atomic fresh-entry claim guard");

  await db.writeAiCache("alice", "stampede", "after-release", null, 15);
  assert.deepEqual(await db.readAiCache("alice", "stampede"), { text: null, fresh: true });
  assert.equal(await db.claimAiCache("alice", "stampede", "negative-cache"), false);
  clock.now = new Date(+clock.now + 15000);
  assert.deepEqual(await db.readAiCache("alice", "stampede"), { text: null, fresh: false });
  pass("null responses are real negative-cache hits and expire at the exact TTL boundary");

  const beforeInvalid = backend.statements.length;
  for (const invalid of ["", " ", null, undefined, 123]) {
    assert.equal(await db.readAiCache(invalid, "key"), null);
    assert.equal(await db.readAiCache("alice", invalid), null);
    assert.equal(await db.claimAiCache("alice", "key", invalid), false);
    assert.equal(await db.claimAiCache(invalid, "key", "owner"), false);
    assert.equal(await db.claimAiCache("alice", invalid, "owner"), false);
    await db.writeAiCache("alice", "key", invalid, "text", 60);
    await db.releaseAiCache("alice", "key", invalid);
    assert.equal(await db.reserveAiBudget(invalid, 1, 5, 10), false);
  }
  for (const invalid of [0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "10", null, undefined]) {
    await db.writeAiCache("alice", "key", "owner", "text", invalid);
    assert.equal(await db.reserveAiBudget("alice", invalid, 100, 100), false);
    assert.equal(await db.reserveAiBudget("alice", 1, invalid, 100), false);
    assert.equal(await db.reserveAiBudget("alice", 1, 100, invalid), false);
  }
  for (const invalid of [undefined, 123, {}, []]) await db.writeAiCache("alice", "key", "owner", invalid, 60);
  assert.equal(await db.reserveAiBudget("alice", 11, 10, 100), false);
  assert.equal(await db.reserveAiBudget("alice", 11, 100, 10), false);
  assert.equal(backend.statements.length, beforeInvalid);
  pass("invalid identities, tokens, text, TTLs and non-positive/unsafe/fractional caps fail closed before accessing the database");

  setup();
  const reservations = await Promise.all(Array.from({ length: 100 }, (_, i) => (i % 2 ? db : anotherInstance).reserveAiBudget(`user-${i % 10}`, 25, 100, 425)));
  assert.equal(reservations.filter(Boolean).length, 17);
  assert.equal(backend.centsUsed("global"), 425);
  for (let i = 0; i < 10; i++) assert.ok(backend.centsUsed(`user:user-${i}`) <= 100);
  assert.equal(backend.reservations, 17);
  pass("concurrent instances cannot exceed either cap; global and user counters reserve atomically under one transaction lock");

  setup();
  assert.equal(await db.reserveAiBudget("alice", 70, 100, 200), true);
  assert.equal(await db.reserveAiBudget("alice", 31, 100, 200), false);
  assert.equal(backend.centsUsed("global"), 70);
  assert.equal(await db.reserveAiBudget("bob", 131, 200, 200), false);
  assert.equal(backend.centsUsed("user:bob"), 0);
  assert.equal(await db.reserveAiBudget("alice", 30, 100, 200), true);
  assert.equal(await db.reserveAiBudget("bob", 100, 100, 200), true);
  assert.equal(backend.centsUsed("global"), 200);
  assert.equal(await db.reserveAiBudget("bob", 1, 100, 200), false);
  pass("exact cap is allowed; rejection of either cap never partially charges the other counter");

  setup();
  clock.now = new Date("2026-09-07T23:59:59.999Z");
  assert.equal(await db.reserveAiBudget("alice", 10, 10, 10), true);
  assert.equal(await db.reserveAiBudget("alice", 1, 10, 10), false);
  clock.now = new Date("2026-09-08T00:00:00.000Z");
  assert.equal(await db.reserveAiBudget("alice", 10, 10, 10), true);
  assert.equal(backend.centsUsed("global", new Date("2026-09-07T12:00:00Z")), 10);
  assert.equal(backend.centsUsed("global"), 10);
  pass("both daily budgets roll over on the database UTC day, independent of user timezone");

  setup();
  for (const failure of ["read", "write", "commit", "query"]) {
    backend.fail = failure;
    assert.equal(await db.reserveAiBudget("alice", 5, 50, 100), false);
    assert.equal(backend.centsUsed("global"), 0);
    assert.equal(backend.centsUsed("user:alice"), 0);
  }
  backend.fail = "ambiguous";
  assert.equal(await db.reserveAiBudget("alice", 5, 50, 100), false);
  assert.equal(backend.centsUsed("global"), 5);
  assert.equal(backend.centsUsed("user:alice"), 5);
  backend.fail = null;
  assert.equal(await db.reserveAiBudget("alice", 45, 50, 100), true);
  assert.equal(await db.reserveAiBudget("alice", 1, 50, 100), false);
  global.__hunteragentPg = undefined;
  global.__hunteragentDbInit = undefined;
  delete process.env.DATABASE_URL;
  assert.equal(await db.reserveAiBudget("alice", 1, 50, 100), false);
  process.env.DATABASE_URL = "postgres://fake/fake";
  setup();
  pass("DB/configuration/commit failures deny calls, partial writes roll back, and ambiguous committed reservations are never refunded");

  for (const invalid of ["NaN", "-1", "0.5", "9007199254740992"]) {
    backend.counterOverride = [{ scope: "global", cents: invalid }];
    assert.equal(await db.reserveAiBudget("alice", 1, 100, 100), false);
  }
  backend.counterOverride = null;
  const maximum = Number.MAX_SAFE_INTEGER;
  assert.equal(await db.reserveAiBudget("alice", maximum - 1, maximum, maximum), true);
  assert.equal(await db.reserveAiBudget("alice", 2, maximum, maximum), false);
  assert.equal(await db.reserveAiBudget("alice", 1, maximum, maximum), true);
  assert.equal(await db.reserveAiBudget("alice", 1, maximum, maximum), false);
  assert.equal(backend.centsUsed("global"), maximum);
  pass("invalid stored counters deny spending and safe-integer maximum caps cannot overflow during cap checks");

  setup();
  assert.equal(await db.claimAiCache("alice", "long-lived", "long-owner"), true);
  await db.writeAiCache("alice", "long-lived", "long-owner", "Private response", 365 * 86400);
  const cached = backend.cache.get(keyFor("alice", "long-lived"));
  assert.equal(cached.expires, +clock.now + 30 * DAY);
  assert.equal(await db.reserveAiBudget("alice", 5, 100, 100), true);
  clock.now = new Date(+clock.now + 30 * DAY - 1);
  assert.equal((await db.readAiCache("alice", "long-lived")).fresh, true);
  clock.now = new Date(+clock.now + 1);
  assert.equal(await db.readAiCache("alice", "long-lived"), null);
  assert.equal(await db.claimAiCache("bob", "recent", "recent-owner"), true);
  await db.writeAiCache("bob", "recent", "recent-owner", "Keep this response", 60);
  await db.pruneDiscoveryStorage();
  assert.equal(backend.cache.has(keyFor("alice", "long-lived")), false);
  assert.equal(backend.cache.has(keyFor("bob", "recent")), true);
  clock.now = new Date(+clock.now + DAY);
  await db.reserveAiBudget("bob", 3, 100, 100);
  await db.pruneDiscoveryStorage();
  assert.equal(backend.usage.size, 2);
  assert.equal(backend.centsUsed("global"), 3);
  assert.ok(backend.statements.some(({ query }) => query.startsWith("DELETE FROM discovery_search_cache")));
  assert.ok(backend.statements.some(({ query }) => query.startsWith("DELETE FROM discovery_credit_usage")));
  pass("TTL capped at 30 days, age-bounded reads before cleanup, old AI responses/counters pruned while existing discovery cleanup stays intact");

  await db.deleteUser("bob");
  assert.equal(await db.readAiCache("bob", "recent"), null);
  assert.equal(backend.cache.size, 0);
  pass("user deletion cascades private cached responses without erasing global spending accounting");
  console.log(`\n${checks} AI storage checks passed. SQL, clock, concurrency and failure modes were mocked; no paid calls.`);
} finally {
  global.__hunteragentPg = original.pg;
  global.__hunteragentDbInit = original.init;
  global.fetch = original.fetch;
  if (original.databaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original.databaseUrl;
}
