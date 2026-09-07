import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cache = new Map();
function load(name) {
  if (name === "@/lib/db") return {};
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

const { verifyJobSource } = load("@/lib/hunteragent-source-verification");
const now = new Date("2026-09-07T12:00:00.000Z");
const role = { id: 1, title: "Product Designer", company: "Acme", location: "London", employment: "Full-time",
  posted: "Today", fit: "", focus: [], proofMode: "required", workSamples: [], summary: "",
  sourceUrl: "https://boards.greenhouse.io/acme/jobs/123", firstSeenAt: now.toISOString(), expiresAt: "2026-09-14T12:00:00.000Z" };
const originalFetch = global.fetch;
try {
  global.fetch = async () => new Response("Join our product design team", { status: 200 });
  assert.equal((await verifyJobSource(role, now)).sourceVerificationStatus, "verified");
  global.fetch = async () => new Response("This position is no longer accepting applications", { status: 200 });
  assert.equal((await verifyJobSource(role, now)).sourceVerificationStatus, "unavailable");
  global.fetch = async () => new Response("Not found", { status: 404 });
  assert.equal((await verifyJobSource(role, now)).sourceVerificationStatus, "unavailable");
  global.fetch = async () => new Response("", { status: 302, headers: { location: "https://example.com/collect" } });
  assert.equal((await verifyJobSource(role, now)).sourceVerificationStatus, "unavailable");
  global.fetch = async () => new Response("Blocked", { status: 403 });
  assert.equal((await verifyJobSource(role, now)).sourceVerificationStatus, "unknown");
  console.log("Source verification checks passed: active, closed, missing, unsafe redirect, and inconclusive responses.");
} finally {
  global.fetch = originalFetch;
}
