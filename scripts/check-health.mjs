import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let checks = 0;

function loadTypeScript(relativePath, overrides = {}) {
  const filename = resolve(root, relativePath);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const unit = { exports: {} };
  const load = (name) => name in overrides ? overrides[name] : require(name);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(load, unit, unit.exports);
  return unit.exports;
}

function pass(label) {
  checks++;
  console.log(`PASS: ${label}`);
}

function request(path = "", token) {
  return new Request(`https://hunteragent.example/api/health${path}`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

async function body(response) {
  return JSON.parse(await response.text());
}

function assertSafeHeaders(response, authenticated = false) {
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("vary"), authenticated ? "Authorization" : null);
}

const configurationNames = [
  "HEALTH_CHECK_TOKEN", "DATABASE_URL", "APP_BASE_URL", "TAVILY_API_KEY", "AGENTMAIL_API_KEY",
  "AGENTMAIL_INBOX_ID", "AGENTMAIL_WEBHOOK_SECRET", "CRON_SECRET",
];
const originalConfiguration = Object.fromEntries(configurationNames.map((name) => [name, process.env[name]]));
const originalPg = global.__hunteragentPg;
const originalInit = global.__hunteragentDbInit;

try {
  process.env.HEALTH_CHECK_TOKEN = "monitor-secret";
  Object.assign(process.env, {
    DATABASE_URL: "postgres://configured.invalid/hunteragent",
    APP_BASE_URL: "https://hunteragent.example",
    TAVILY_API_KEY: "configured",
    AGENTMAIL_API_KEY: "configured",
    AGENTMAIL_INBOX_ID: "configured",
    AGENTMAIL_WEBHOOK_SECRET: "configured",
    CRON_SECRET: "configured",
  });

  let databaseResult = true;
  let databaseCalls = 0;
  const health = loadTypeScript("app/api/health/route.ts", {
    "@/lib/db": {
      checkDatabaseConnectivity: async () => {
        databaseCalls++;
        return databaseResult;
      },
    },
  });

  let response = await health.GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { status: "live" });
  assert.equal(databaseCalls, 0);
  assertSafeHeaders(response);
  pass("public liveness is uncached and does not touch the database");

  for (const token of [undefined, "", "wrong-secret"]) {
    response = await health.GET(request("?readiness=1", token));
    assert.equal(response.status, 401);
    assert.deepEqual(await body(response), { status: "unauthorized" });
    assertSafeHeaders(response, true);
  }
  assert.equal(databaseCalls, 0);
  pass("readiness rejects missing and incorrect credentials before database access");

  databaseResult = true;
  response = await health.GET(request("?readiness=1", "monitor-secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { status: "ready" });
  assert.equal(databaseCalls, 1);
  assertSafeHeaders(response, true);

  databaseResult = false;
  response = await health.GET(request("?readiness=1", "monitor-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await body(response), { status: "not_ready" });
  assert.equal(databaseCalls, 2);
  assertSafeHeaders(response, true);
  pass("authenticated readiness reports only a safe database-backed state");

  databaseResult = true;
  delete process.env.AGENTMAIL_API_KEY;
  response = await health.GET(request("?readiness=1", "monitor-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await body(response), { status: "not_ready" });
  assert.equal(databaseCalls, 2);
  process.env.AGENTMAIL_API_KEY = "configured";
  process.env.APP_BASE_URL = "http://hunteragent.example/path";
  response = await health.GET(request("?readiness=1", "monitor-secret"));
  assert.equal(response.status, 503);
  assert.deepEqual(await body(response), { status: "not_ready" });
  assert.equal(databaseCalls, 2);
  process.env.APP_BASE_URL = "https://hunteragent.example";
  pass("readiness fails closed on missing providers or an unsafe public app URL without naming them");

  delete process.env.HEALTH_CHECK_TOKEN;
  response = await health.GET(request("?readiness=1", "monitor-secret"));
  assert.equal(response.status, 401);
  assert.deepEqual(await body(response), { status: "unauthorized" });
  assert.equal(databaseCalls, 2);
  pass("an unconfigured readiness token fails closed without revealing configuration");

  process.env.HEALTH_CHECK_TOKEN = "monitor-secret";
  response = await health.HEAD(request());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assertSafeHeaders(response);
  response = await health.HEAD(request("?readiness=1", "wrong-secret"));
  assert.equal(response.status, 401);
  assert.equal(await response.text(), "");
  assertSafeHeaders(response, true);
  pass("HEAD mirrors health status and headers without a response body");

  const db = loadTypeScript("lib/db.ts", {
    "@/lib/hunteragent-data": { createInitialWorkspaceState: () => ({}) },
  });

  function installQuery(result, { reject = false, pending = false } = {}) {
    let cancelled = false;
    const sql = () => {
      const query = pending
        ? new Promise(() => {})
        : reject ? Promise.reject(new Error("private database failure")) : Promise.resolve(result);
      query.cancel = () => { cancelled = true; };
      return query;
    };
    global.__hunteragentPg = sql;
    return () => cancelled;
  }

  installQuery([{ ok: 1 }]);
  assert.equal(await db.checkDatabaseConnectivity(), true);
  installQuery([{ ok: 0 }]);
  assert.equal(await db.checkDatabaseConnectivity(), false);
  installQuery([], { reject: true });
  assert.equal(await db.checkDatabaseConnectivity(), false);
  const wasCancelled = installQuery([], { pending: true });
  assert.equal(await db.checkDatabaseConnectivity(5), false);
  assert.equal(wasCancelled(), true);
  assert.equal(await db.checkDatabaseConnectivity(0), false);
  pass("database probe validates SELECT 1 and cancels stalled checks safely");

  const serialized = JSON.stringify([
    await body(await health.GET(request())),
    await body(await health.GET(request("?readiness=1", "monitor-secret"))),
  ]);
  for (const forbidden of ["DATABASE_URL", "HEALTH_CHECK_TOKEN", "monitor-secret", "postgres", "supabase", "anthropic", "tavily"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
  pass("public response schema contains no secrets or provider configuration");
} finally {
  for (const [name, value] of Object.entries(originalConfiguration)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  global.__hunteragentPg = originalPg;
  global.__hunteragentDbInit = originalInit;
}

console.log(`Health checks passed: ${checks}`);
