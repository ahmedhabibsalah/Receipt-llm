#!/usr/bin/env node
/**
 * dep-graph.js
 *
 * Walks the repo, finds require()/import statements (and child_process
 * spawn/execFile calls that point at a .py or .js file), and builds a
 * REVERSE dependency graph: for each file, which other files depend on it.
 *
 * That reverse count is "blast radius" — how many other files break if
 * this one breaks. No AI involved; this is plain static analysis.
 *
 * Usage (run from your repo root):
 *   node dep-graph.js
 *
 * Output:
 *   dep-graph.json in the current directory
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "coverage",
  "uploads", "llm-images", "bob_sessions", ".vscode", ".bob"
]);

const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py"]);

// --- 1. collect all code files ---
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".bobignore") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (CODE_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT);
const relFiles = new Set(files.map(f => path.relative(ROOT, f).replace(/\\/g, "/")));

// --- 2. resolve a require/import specifier to an actual file in the repo ---
function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith(".")) return null; // skip npm packages
  const baseDir = path.dirname(fromFile);
  const raw = path.resolve(baseDir, spec);

  const candidates = [
    raw,
    raw + ".js", raw + ".mjs", raw + ".cjs", raw + ".ts", raw + ".tsx", raw + ".py",
    path.join(raw, "index.js"), path.join(raw, "index.ts"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(ROOT, c).replace(/\\/g, "/");
    }
  }
  return null;
}

// --- 3. scan each file for edges ---
const REQUIRE_RE = /require\(\s*["']([^"']+)["']\s*\)/g;
const IMPORT_RE = /import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
const SPAWN_PY_RE = /["']([^"']+\.py)["']/g;

const edges = []; // { from, to }

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (path.extname(file) === ".py") continue; // we don't trace python->python here
  let content;
  try { content = fs.readFileSync(file, "utf8"); } catch { continue; }

  let m;
  while ((m = REQUIRE_RE.exec(content))) {
    const resolved = resolveSpecifier(file, m[1]);
    if (resolved) edges.push({ from: rel, to: resolved, kind: "require" });
  }
  while ((m = IMPORT_RE.exec(content))) {
    const resolved = resolveSpecifier(file, m[1]);
    if (resolved) edges.push({ from: rel, to: resolved, kind: "import" });
  }

  // detect spawn("python", [..., "something.py", ...]) style calls
  if (/spawn\(|execFile\(|execFileSync\(|spawnSync\(/.test(content)) {
    let pm;
    while ((pm = SPAWN_PY_RE.exec(content))) {
      const target = pm[1].replace(/^\.\//, "");
      const matchFile = [...relFiles].find(f => f.endsWith(target) || f === target);
      if (matchFile) edges.push({ from: rel, to: matchFile, kind: "spawn" });
    }
  }
}

// dedupe edges
const seen = new Set();
const uniqueEdges = edges.filter(e => {
  const key = e.from + "->" + e.to;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// --- 4. build reverse graph (dependents) and blast radius ---
const dependents = {};
for (const f of relFiles) dependents[f] = [];
for (const e of uniqueEdges) {
  if (!dependents[e.to]) dependents[e.to] = [];
  dependents[e.to].push(e.from);
}

const blastRadius = {};
for (const [file, deps] of Object.entries(dependents)) {
  blastRadius[file] = deps.length;
}

const output = {
  generatedAt: new Date().toISOString(),
  fileCount: relFiles.size,
  edgeCount: uniqueEdges.length,
  edges: uniqueEdges,
  dependents,
  blastRadius,
};

fs.writeFileSync(path.join(ROOT, "dep-graph.json"), JSON.stringify(output, null, 2));

console.log(`Scanned ${relFiles.size} files, found ${uniqueEdges.length} edges.`);
console.log("Blast radius (files with 1+ dependents):");
Object.entries(blastRadius)
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1])
  .forEach(([f, n]) => console.log(`  ${n}  ${f}`));
console.log("\nWrote dep-graph.json");
