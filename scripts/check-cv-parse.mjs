import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const require = createRequire(import.meta.url);

function loadRoute(overrides) {
  const filename = path.join(root, "app/api/parse-cv/route.ts");
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const unit = { exports: {} };
  const localRequire = (name) => name in overrides ? overrides[name] : require(name);
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(localRequire, unit, unit.exports);
  return unit.exports;
}

class AuthError extends Error {}
const json = (value, init) => Response.json(value, init);
const logger = { info() {}, warn() {}, error() {}, debug() {} };

{
  let calls = 0;
  const route = loadRoute({
    "next/server": { NextResponse: { json } },
    "@/lib/auth": { AuthError, requireUser: async () => { throw new AuthError("Sign in to continue."); } },
    "@/lib/hunteragent-ai": { callTaskAi: async () => { calls++; } },
    "@/lib/logger": { logger },
  });
  const response = await route.POST(new Request("http://local/api/parse-cv", { method: "POST", body: new FormData() }));
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
}

{
  let call;
  const route = loadRoute({
    "next/server": { NextResponse: { json } },
    "@/lib/auth": { AuthError, requireUser: async () => ({ id: "user-1" }) },
    "@/lib/hunteragent-ai": { callTaskAi: async (...args) => {
      call = args;
      return JSON.stringify({ name: "Jamie", currentTitle: "Design Lead", targetRoles: ["Design Director"], locations: "London", coreStrength: "Builds product teams" });
    } },
    "@/lib/logger": { logger },
  });
  const empty = await route.POST(new Request("http://local/api/parse-cv", { method: "POST", body: new FormData() }));
  assert.equal(empty.status, 400);
  assert.equal(call, undefined);

  const form = new FormData();
  form.set("file", new File(["Jamie\nDesign Lead\nExperience\nProduct Designer"], "cv.txt", { type: "text/plain" }));
  const response = await route.POST(new Request("http://local/api/parse-cv", { method: "POST", body: form }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.profile.name, "Jamie");
  assert.equal(call[0], "cvParse");
  assert.equal(call[3].userId, "user-1");
  assert.equal(call[3].validate(call[1]), false);
}

{
  const route = loadRoute({
    "next/server": { NextResponse: { json } },
    "@/lib/auth": { AuthError, requireUser: async () => ({ id: "user-2" }) },
    "@/lib/hunteragent-ai": { callTaskAi: async () => null },
    "@/lib/logger": { logger },
  });
  const form = new FormData();
  form.set("file", new File(["Alex Morgan\nGrowth Manager\nSummary\nLifecycle strategy"], "cv.txt", { type: "text/plain" }));
  const response = await route.POST(new Request("http://local/api/parse-cv", { method: "POST", body: form }));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.profile.name, "Alex Morgan");
  assert.equal(payload.profile.currentTitle, "Growth Manager");
}

console.log("CV parsing route checks passed.");
