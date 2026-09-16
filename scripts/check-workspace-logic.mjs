import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Run the existing TS modules with their path aliases, without installing a test runtime.
function modules(overrides = {}) {
  const cache = new Map();
  function load(name) {
    if (name in overrides) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = resolve(root, `${name.slice(2)}.ts`);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const unit = { exports: {} };
    cache.set(name, unit);
    const execute = vm.runInThisContext(
      `(function(require,module,exports){${output}\n})`,
      { filename },
    );
    execute(load, unit, unit.exports);
    return unit.exports;
  }
  return load;
}

const real = modules();
const { createInitialWorkspaceState, createBriefRecord, DAILY_ROLES } = real(
  "@/lib/hunteragent-data",
);
const first = createInitialWorkspaceState();
const second = createInitialWorkspaceState();
assert.notEqual(first.profile, second.profile);
assert.notEqual(first.profile.guidedResume, second.profile.guidedResume);
assert.notEqual(first.roleCatalog, second.roleCatalog);
assert.deepEqual(first.roleCatalog, [], "Real accounts must not inherit demo jobs");
console.log("PASS: new workspaces do not share mutable defaults");
function workspace() {
  const state = createInitialWorkspaceState();
  state.roleCatalog = structuredClone(DAILY_ROLES);
  const brief = createBriefRecord("scheduled", state.roleCatalog);
  brief.selectedRoleIds = brief.roleIds.slice(0, 2);
  state.briefs = [brief];
  state.activeBriefId = brief.id;
  state.profile.name = "Test Candidate";
  return state;
}

let calls = 0;
const withSpy = modules({
  "@/lib/hunteragent-anthropic": {
    generateApplicationPack: async () => {
      calls++;
      throw new Error("Self-managed mode must not generate AI materials");
    },
  },
});
const selfManaged = workspace();
selfManaged.profile.materialsMode = "self";
await withSpy(
  "@/lib/hunteragent-workspace-ops",
).generateSelectedPacksForWorkspace(selfManaged);
assert.equal(calls, 0);
assert.equal(selfManaged.flowPhase, "studio");
assert.equal(selfManaged.packs.length, 2);
assert.ok(selfManaged.packs.every((pack) => !pack.cvSummary && !pack.letter));
selfManaged.packs[0].cvSummary = "Previously saved material";
await withSpy(
  "@/lib/hunteragent-workspace-ops",
).generateSelectedPacksForWorkspace(selfManaged);
assert.equal(selfManaged.packs[0].cvSummary, "Previously saved material");
console.log(
  "PASS: self-managed mode creates tracking records, preserves existing content, makes zero model calls",
);

const apiKey = process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
try {
  const ai = workspace();
  const { generateSelectedPacksForWorkspace } = real(
    "@/lib/hunteragent-workspace-ops",
  );
  await generateSelectedPacksForWorkspace(ai);
  assert.equal(ai.packs.length, 2);
  assert.ok(
    ai.packs.every(
      (pack) => pack.provider === "fallback" && pack.cvSummary && pack.letter,
    ),
  );
  const pack = ai.packs[0];
  const letter = pack.letter;
  const samples = structuredClone(pack.workSampleSelections);
  await generateSelectedPacksForWorkspace(ai, {
    roleId: pack.roleId,
    target: "cv",
    intent: "edit",
    instruction: "Make it more direct",
  });
  const edited = ai.packs.find((item) => item.roleId === pack.roleId);
  assert.equal(edited.letter, letter);
  assert.deepEqual(edited.workSampleSelections, samples);
  assert.equal(ai.promptHistory[`${pack.roleId}:cv`], undefined, "An unsuccessful AI refinement is not a successful history entry");
  assert.equal(edited.cvSummary, pack.cvSummary);
  assert.match(ai.generationStatus, /Existing documents were kept/);
  assert.equal(ai.promptDrafts[`${pack.roleId}:cv`], "Make it more direct");
  console.log(
    "PASS: fallback generation, CV-only edit preservation, role/section prompt memory",
  );
} finally {
  if (apiKey !== undefined) process.env.ANTHROPIC_API_KEY = apiKey;
}
