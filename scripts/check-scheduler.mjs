import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const require = createRequire(import.meta.url);

function load(relative, overrides = {}) {
  const filename = path.join(root, relative);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const unit = { exports: {} };
  const localRequire = (name) => name in overrides ? overrides[name] : require(name);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(localRequire, unit, unit.exports);
  return unit.exports;
}

const originalFetch = global.fetch;
const originalNow = Date.now;
const previous = Object.fromEntries(["URL", "APP_BASE_URL", "CRON_SECRET"].map((key) => [key, process.env[key]]));
try {
  let cron;
  const scheduled = load("netlify/functions/daily-briefs.ts", {
    "@netlify/functions": { schedule: (value, handler) => { cron = value; return handler; } },
  });
  process.env.URL = "https://hunteragent.example/";
  process.env.CRON_SECRET = "test-secret";
  let request;
  global.fetch = async (...args) => {
    request = args;
    return new Response(null, { status: 202 });
  };
  const dispatched = await scheduled.handler({}, {});
  assert.equal(cron, "*/15 * * * *");
  assert.equal(dispatched.statusCode, 200);
  assert.equal(request[0], "https://hunteragent.example/.netlify/functions/daily-briefs-background");
  assert.equal(request[1].headers.authorization, "Bearer test-secret");

  let backgroundRuns = 0;
  const background = load("netlify/functions/daily-briefs-background.ts", {
    "@netlify/functions": {},
    "../../lib/run-daily-briefs": { runDailyBriefs: async (_now, options) => {
      backgroundRuns++;
      assert.equal(options.maxRuntimeMs, 13 * 60_000);
      return { results: [] };
    } },
  });
  await background.handler({ headers: {} }, {});
  assert.equal(backgroundRuns, 0);
  await background.handler({ headers: { authorization: "Bearer test-secret" } }, {});
  assert.equal(backgroundRuns, 1);

  const snapshots = ["one", "two", "three"].map((userId) => ({
    userId,
    state: { onboardingComplete: true, profile: { recipientEmail: "user@example.test", briefsPaused: false } },
  }));
  let updates = 0;
  const runner = load("lib/run-daily-briefs.ts", {
    "@/lib/db": { pruneDiscoveryStorage: async () => {} },
    "@/lib/product-analytics": { recordProductEvent: async () => {} },
    "@/lib/hunteragent-scheduling": {
      CRON_CADENCE_MINUTES: 15,
      hasSentBriefOnLocalDay: () => false,
      shouldRunBriefNow: () => true,
    },
    "@/lib/hunteragent-store": {
      listStoredWorkspaces: async () => snapshots,
      updateWorkspaceState: async (callback, userId) => {
        updates++;
        return callback(structuredClone(snapshots.find((item) => item.userId === userId).state));
      },
    },
    "@/lib/hunteragent-briefs": { prepareFreshBrief: async () => ({ brief: null }), sendPreparedBrief: async () => {} },
  });
  const ticks = [0, 0, 120_001, 120_002];
  Date.now = () => ticks.shift() ?? 120_002;
  const result = await runner.runDailyBriefs(new Date(), { maxRuntimeMs: 120_000 });
  assert.equal(updates, 1);
  assert.equal(result.results.filter((item) => item.status.startsWith("Deferred:")).length, 2);
} finally {
  global.fetch = originalFetch;
  Date.now = originalNow;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

console.log("Scheduled/background delivery checks passed.");
