import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const unit = { exports: {} };
    cache.set(name, unit);
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(load, unit, unit.exports);
    return unit.exports;
  }
  return load;
}

let rateCall = null;
const rate = modules({
  "@/lib/db": {
    consumeAuthRateLimit: async (...args) => {
      rateCall = args;
      return true;
    },
  },
})("@/lib/auth-rate-limit");

assert.equal(rate.clientAddress(new Request("https://example.test", {
  headers: { "x-nf-client-connection-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.4" },
})), "203.0.113.7");
assert.equal(await rate.allowAuthAttempt("login", " Person@Example.com ", 10, 900), true);
assert.deepEqual(rateCall, [
  createHash("sha256").update("login:person@example.com").digest("hex"),
  10,
  900,
]);

let resetCalls = 0;
let resetAllowed = true;
const resetRoute = modules({
  "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
  "bcryptjs": { __esModule: true, default: { hash: async () => "hashed-password" } },
  "@/lib/auth": { validatePassword: (password) => password.length >= 6 && /[0-9]/.test(password) },
  "@/lib/auth-rate-limit": { allowAuthAttempt: async () => true, clientAddress: () => "203.0.113.7" },
  "@/lib/db": {
    resetUserPasswordWithToken: async (tokenHash, passwordHash, updatedAt, nowIso) => {
      resetCalls++;
      assert.equal(tokenHash.length, 64);
      assert.equal(passwordHash, "hashed-password");
      assert.equal(updatedAt, nowIso);
      return resetAllowed;
    },
  },
})("@/app/api/auth/reset-password/route");

const postReset = (body) => resetRoute.POST(new Request("https://example.test/api/auth/reset-password", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}));

assert.equal((await postReset({ token: "token", password: "weak" })).status, 400);
assert.equal(resetCalls, 0);
assert.equal((await postReset({ token: "token", password: "strong1" })).status, 200);
assert.equal(resetCalls, 1);
resetAllowed = false;
assert.equal((await postReset({ token: "used-token", password: "strong1" })).status, 400);
assert.equal(resetCalls, 2);

const database = readFileSync(resolve(root, "lib/db.ts"), "utf8");
assert.match(database, /DELETE FROM password_reset_tokens[\s\S]*RETURNING user_id/);
assert.match(database, /DELETE FROM sessions WHERE user_id/);
assert.match(database, /ON CONFLICT \(key_hash\) DO UPDATE/);
assert.match(database, /RETURNING hits <= \$\{maxHits\} AS allowed/);
assert.match(database, /catch \{[\s\S]*return false;[\s\S]*\}/);

for (const route of ["login", "signup", "forgot-password", "reset-password"]) {
  const source = readFileSync(resolve(root, `app/api/auth/${route}/route.ts`), "utf8");
  assert.match(source, /allowAuthAttempt\(/, `${route} must use the shared durable limiter`);
}

console.log("Auth security checks passed.");
