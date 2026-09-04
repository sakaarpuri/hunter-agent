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
  if (name === "@/lib/db") return { claimDiscoveryRun: () => { throw new Error("A hard filter must not spend credits"); } };
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

const { initialProfile } = load("@/lib/hunteragent-data");
const discovery = load("@/lib/hunteragent-discovery");
const now = new Date("2026-09-07T08:00:00.000Z");
let sequence = 100;
function profile(overrides = {}) {
  return { ...structuredClone(initialProfile), targetRoles: ["Senior Product Designer"], locations: "", workplaceModes: [], workTypes: [], remoteRegions: [], ...overrides };
}
function role(overrides = {}) {
  const id = ++sequence;
  return { id, sourceUrl: `https://boards.greenhouse.io/fixtures/jobs/${id}`, firstSeenAt: now.toISOString(), expiresAt: "2026-09-14T08:00:00.000Z", company: "Acme", title: "Senior Product Designer", employment: "Not specified", location: "Location not specified", summary: "Details not provided.", fit: "", focus: [], proofMode: "optional", workSamples: [], posted: "Not specified", ...overrides };
}

let assertions = 0;
function check(label, expected, job, preferences = {}) {
  const candidate = role(job);
  const requested = profile(preferences);
  const before = JSON.stringify({ candidate, requested });
  assert.equal(discovery.matchesHardFilters(candidate, requested), expected, label);
  assert.equal(discovery.rankUnseenRoles([candidate], requested, {}, now).length, expected ? 1 : 0, `${label}: discovery pipeline`);
  assert.equal(JSON.stringify({ candidate, requested }), before, `${label}: must not mutate facts/preferences`);
  assertions++;
}

check("exact designer title", true, {});
check("design/designer synonyms and seniority differences", true, { title: "Product Design Lead" });
check("shared seniority is not an occupation", false, { title: "Senior Photographer" });
check("product manager is not product designer", false, { title: "Senior Product Designer" }, { targetRoles: ["Senior Product Manager"] });
check("engineering manager is not individual contributor", false, { title: "Mechanical Engineer" }, { targetRoles: ["Engineering Manager"] });
check("same management occupation remains eligible", true, { title: "Senior Product Manager" }, { targetRoles: ["Product Manager"] });
check("shared product modifier is not design work", false, { title: "Senior Product Photographer" });
check("shared design modifier does not match the wrong discipline", false, { title: "Senior Brand Designer" });
check("generic design target accepts product design", true, { title: "Product Design Lead" }, { targetRoles: ["Designer"] });
check("UX synonym remains meaningful", true, { title: "Principal User Experience Designer" }, { targetRoles: ["UX Designer"] });
check("UX researcher is not UX designer", false, { title: "Senior UX Researcher" }, { targetRoles: ["Senior UX Designer"] });
check("word boundary, not substring", false, { title: "Senior Redesigning Specialist" }, { targetRoles: ["Designer"] });
check("software developer/engineer synonyms", true, { title: "Principal Software Developer" }, { targetRoles: ["Senior Software Engineer"] });
check("software synonym works both ways", true, { title: "Software Engineer, Flight Software (Starship)" }, { targetRoles: ["Software Developer"] });
check("frontend software domain", true, { title: "Front-End Developer" }, { targetRoles: ["Software Engineer"] });
check("front end spelling variation", true, { title: "Frontend Engineer" }, { targetRoles: ["Front End Developer"] });
check("civil engineering is not software", false, { title: "Senior Civil Engineer" }, { targetRoles: ["Senior Software Engineer"] });
check("business development is not software", false, { title: "Senior Business Development Manager" }, { targetRoles: ["Senior Software Developer"] });
check("C-suite CEO expanded synonym", true, { title: "Chief Executive Officer" }, { targetRoles: ["CEO"] });
check("C-suite synonym in reverse", true, { title: "CEO" }, { targetRoles: ["Chief Executive"] });
check("CISO expanded synonym", true, { title: "Chief Information Security Officer" }, { targetRoles: ["CISO"] });
check("different C-suite functions are not interchangeable", false, { title: "Chief Financial Officer" }, { targetRoles: ["Chief Technology Officer"] });
check("chief title alone is insufficient", false, { title: "Chief Photographer" }, { targetRoles: ["Chief Executive Officer"] });
check("assistant to CEO is not CEO", false, { title: "Executive Assistant to the CEO" }, { targetRoles: ["CEO"] });
check("adventure guiding job remains eligible", true, { title: "Aurora & Fjord Tour Guide" }, { targetRoles: ["Tour Guide"] });
check("guide seniority irrelevant", true, { title: "Lead Adventure Guide" }, { targetRoles: ["Adventure Guide"] });
check("adventure marketing is not guiding", false, { title: "Senior Adventure Marketing Manager" }, { targetRoles: ["Senior Adventure Guide"] });
check("marine science role", true, { title: "Marine Biologist" }, { targetRoles: ["Senior Marine Biologist"] });
check("multiple occupations are alternatives", true, { title: "Software Engineer" }, { targetRoles: ["Product Designer", "Software Developer"] });
check("blank optional targets do not block everything", true, { title: "Marine Biologist" }, { targetRoles: ["", " ", ""] });
check("seniority-only target cannot match by seniority", false, { title: "Senior Photographer" }, { targetRoles: ["Senior"] });
console.log("PASS: meaningful occupations, conservative synonyms, C-suite and adventure fixtures");

check("explicit on-site conflicts with remote-only", false, { location: "London / On-site" }, { workplaceModes: ["remote"] });
check("hybrid is not fully remote", false, { location: "London / Hybrid" }, { workplaceModes: ["remote"] });
check("explicit mode preference accepted", true, { location: "London / Hybrid" }, { workplaceModes: ["hybrid"] });
check("unknown workplace mode remains eligible", true, { location: "London" }, { workplaceModes: ["remote"] });
check("no remote is not remote", false, { summary: "No remote work offered." }, { workplaceModes: ["remote"] });
check("company excluded by whole phrase", false, { company: "Acme Studios Ltd" }, { excludedCompanies: ["Acme Studios"] });
check("company exclusion not a substring collision", true, { company: "Acme" }, { excludedCompanies: ["Me"] });
check("company exclusion case/punctuation normalization", false, { company: "ACME-STUDIOS" }, { excludedCompanies: ["acme studios"] });
check("full-time and part-time conflict", false, { employment: "Part-time" }, { workTypes: ["Full-time"] });
check("part-time and full-time conflict", false, { employment: "Full-time" }, { workTypes: ["Part-time"] });
check("contract conflict", false, { employment: "Contract" }, { workTypes: ["Full-time"] });
check("permanent conflicts with contract-only", false, { employment: "Permanent" }, { workTypes: ["Contract"] });
check("contract/freelance synonym", true, { employment: "Freelance" }, { workTypes: ["Contract"] });
check("fixed-term contract", true, { employment: "Fixed-term" }, { workTypes: ["Contract"] });
check("either advertised schedule can fit", true, { employment: "Full-time or Part-time" }, { workTypes: ["Part-time"] });
check("unspecified employment is not ineligible", true, {}, { workTypes: ["Full-time"] });
check("permanent with unspecified hours is not automatically full-time", true, { employment: "Permanent" }, { workTypes: ["Part-time"] });
console.log("PASS: explicit mode, company and employment conflicts without unknown-data assumptions");

check("on-site explicit countries conflict", false, { location: "Berlin, Germany / On-site" }, { locations: "London, UK" });
check("on-site explicit cities conflict", false, { location: "Bristol, UK / On-site" }, { locations: "London, UK" });
check("on-site selected city matches", true, { location: "London, United Kingdom / On-site" }, { locations: "London" });
check("country preference includes cities", true, { location: "Manchester, UK / On-site" }, { locations: "UK" });
check("country-wide alternative is honored", true, { location: "Bristol, UK / On-site" }, { locations: "London or UK" });
check("European preference includes Norway", true, { title: "Adventure Guide", location: "Tromso, Norway / On-site" }, { targetRoles: ["Adventure Guide"], locations: "Europe" });
check("adventure location conflict remains a hard filter", false, { title: "Tour Guide", location: "Tromso, Norway / On-site" }, { targetRoles: ["Tour Guide"], locations: "UK" });
check("hybrid explicit location conflict", false, { location: "Seoul, South Korea / Hybrid" }, { locations: "London" });
check("structured summary location counts as explicit evidence", false, { location: "On-site", summary: "Location: Berlin, Germany. Work in the office." }, { locations: "London" });
check("unstructured customer location is not job location", true, { location: "On-site", summary: "We serve customers in Berlin, Germany." }, { locations: "London" });
check("unknown geography does not invent a conflict", true, { location: "Unspecified campus / On-site" }, { locations: "London" });
check("unspecified user location is not a conflict", true, { location: "Seoul, South Korea / On-site" });
check("worldwide user location accepts on-site locations", true, { location: "Seoul, South Korea / On-site" }, { locations: "Worldwide" });
check("New York spelling alias", true, { location: "New York / On-site" }, { locations: "NYC" });
console.log("PASS: explicit geographic conflicts, country/city hierarchy and unknown-location preservation");

check("worldwide remote listing fits UK preference", true, { location: "Remote worldwide" }, { remoteRegions: ["uk"] });
check("worldwide listing fits US preference", true, { location: "Remote anywhere" }, { remoteRegions: ["us"] });
check("worldwide listing with US team is still worldwide", true, { location: "Remote worldwide (US team)" }, { remoteRegions: ["uk"] });
check("US-only remote does not fit UK", false, { location: "Remote - US only" }, { remoteRegions: ["uk"] });
check("UK-only remote does not fit US", false, { location: "Remote - UK only" }, { remoteRegions: ["us"] });
check("worldwide preference is not regional eligibility", false, { location: "Remote - US only" }, { remoteRegions: ["worldwide"], locations: "London" });
check("regional eligibility can also come from explicit target location", true, { location: "Remote - UK only" }, { remoteRegions: ["worldwide"], locations: "London" });
check("worldwide-only search does not accept restricted regions", false, { location: "Remote - US only" }, { remoteRegions: ["worldwide"] });
check("EU-only does not mean UK eligible", false, { location: "Remote - EU only" }, { remoteRegions: ["uk"] });
check("Europe search includes EU opportunities", true, { location: "Remote - EU only" }, { remoteRegions: ["europe"] });
check("European country remote listing", true, { location: "Remote - France" }, { remoteRegions: ["europe"] });
check("Northern Ireland is in the UK group", true, { location: "Remote - Northern Ireland" }, { remoteRegions: ["uk"] });
check("explicit summary residency limitation", false, { location: "Remote", summary: "Candidates must be based in the United States." }, { remoteRegions: ["uk"] });
check("explicit restriction overrides broad worldwide wording", false, { location: "Remote worldwide", summary: "US residents only." }, { remoteRegions: ["uk"] });
check("timezone wording does not invent a residence restriction", true, { location: "Remote - US time zones" }, { remoteRegions: ["uk", "timezone-compatible"] });
check("unknown remote geography remains eligible", true, { location: "Remote", summary: "Join us to design products for customers in Europe and the US." }, { remoteRegions: ["uk"] });
check("remote headquarters are not a residence requirement", true, { location: "Remote", summary: "Our headquarters are in San Francisco, US." }, { remoteRegions: ["uk"] });
check("unknown salary and visa facts do not create disqualifications", true, { location: "Remote" }, { remoteRegions: ["uk"], salary: "120000 GBP", specialPreferences: ["Visa sponsorship", "No overtime"] });
console.log("PASS: worldwide/region eligibility, UK vs EU, explicit residency and unknown salary/visa data");

const valid = role();
const other = role({ title: "Senior Photographer" });
const expired = role({ firstSeenAt: "2026-08-31T08:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" });
const duplicate = { ...valid, id: valid.id + 10000, sourceUrl: `${valid.sourceUrl}?utm_source=another` };
assert.deepEqual(discovery.rankUnseenRoles([other, expired, valid, duplicate], profile(), {}, now).map((item) => item.id), [valid.id]);
assert.deepEqual(discovery.rankUnseenRoles([valid], profile(), { [discovery.roleFingerprint(valid.sourceUrl)]: now.toISOString() }, now), []);
assert.deepEqual(discovery.buildPublicQueries(profile({ locations: "London", name: "Private Name", salary: "Secret salary", specialPreferences: ["Private preference"] })), ['"senior product designer" jobs london']);
const pooled = await discovery.discoverRoles(profile(), { now, pool: [other, valid], lastDiscoveryAt: now.toISOString() });
assert.deepEqual(pooled.roles.map((item) => item.id), [valid.id]);
assert.equal(pooled.status, "pool");
console.log("PASS: unchanged dedupe, expiry, seen-job suppression, public queries and cached-pool discovery");
console.log(`\n${assertions} fixture checks plus discovery invariants passed. No AI, network, database or secrets used.`);
