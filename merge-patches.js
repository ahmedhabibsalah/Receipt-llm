const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const FINDINGS_PATH = path.join(ROOT, "bob_sessions", "findings.json");
const PATCHES_PATH = path.join(ROOT, "bob_sessions", "patches.json");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

if (!fs.existsSync(FINDINGS_PATH)) {
  console.error("bob_sessions/findings.json not found.");
  process.exit(1);
}
if (!fs.existsSync(PATCHES_PATH)) {
  console.error(
    "bob_sessions/patches.json not found — generate patches with Bob first.",
  );
  process.exit(1);
}

const findings = readJSON(FINDINGS_PATH);
const patches = readJSON(PATCHES_PATH);

const patchByKey = new Map();
patches.forEach((p) => patchByKey.set(`${p.file}::${p.id}`, p));

let attached = 0;
const unmatched = [];

const merged = findings.map((f) => {
  const key = `${f.file}::${f.id}`;
  const patch = patchByKey.get(key);
  if (patch) {
    attached++;
    return {
      ...f,
      patch: {
        before: patch.before,
        after: patch.after,
        generatedByBob: patch.generatedByBob !== false,
      },
    };
  }
  return f;
});

const findingKeys = new Set(findings.map((f) => `${f.file}::${f.id}`));
patches.forEach((p) => {
  const key = `${p.file}::${p.id}`;
  if (!findingKeys.has(key)) unmatched.push(key);
});

fs.writeFileSync(FINDINGS_PATH, JSON.stringify(merged, null, 2));

console.log(`Attached ${attached} patch(es) to findings.json.`);
if (unmatched.length) {
  console.log(
    `Note: ${unmatched.length} patch(es) had no matching finding id (kept as bonus fixes, not shown in UI):`,
  );
  unmatched.forEach((k) => console.log("  " + k));
}
console.log("\nNow re-run: node merge-risk.js");
