const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SEV_WEIGHT = { high: 3, medium: 2, low: 1 };

function readJSON(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

const depGraph = readJSON(path.join(ROOT, "dep-graph.json"));
if (!depGraph) {
  console.error("dep-graph.json not found — run dep-graph.js first.");
  process.exit(1);
}

const findingsRaw = readJSON(
  path.join(ROOT, "bob_sessions", "findings.json"),
  [],
);
const pkg = readJSON(path.join(ROOT, "package.json"), {});
const scriptTargets = Object.values(pkg.scripts || {}).join(" ");

// --- group findings by file ---
const findingsByFile = {};
for (const f of findingsRaw) {
  (findingsByFile[f.file] ||= []).push(f);
}

// --- exposure detection: read each file, look for direct-reachability signals ---
const EXPOSURE_SIGNALS = [
  { re: /\.listen\s*\(/, score: 3, reason: "starts an HTTP server directly" },
  {
    re: /\b(app|router)\.(get|post|put|delete|patch|use)\s*\(/,
    score: 2,
    reason: "defines HTTP route handlers",
  },
  {
    re: /require\.main\s*===\s*module/,
    score: 1,
    reason: "runnable as a CLI entry point",
  },
  { re: /^#!/, score: 1, reason: "has a shebang — runnable directly" },
];

function detectExposure(relFile) {
  const full = path.join(ROOT, relFile);
  let content = "";
  try {
    content = fs.readFileSync(full, "utf8");
  } catch {
    return { score: 0, reasons: [] };
  }

  let score = 0;
  const reasons = [];
  for (const sig of EXPOSURE_SIGNALS) {
    if (sig.re.test(content)) {
      reasons.push(sig.reason);
      score = Math.max(score, sig.score);
    }
  }
  if (scriptTargets.includes(relFile)) {
    reasons.push("invoked directly via a package.json script");
    score = Math.max(score, 1);
  }
  return { score, reasons };
}

// --- build per-file risk record ---
const allFiles = new Set([
  ...Object.keys(depGraph.blastRadius || {}),
  ...Object.keys(findingsByFile),
]);

const files = [...allFiles]
  .map((file) => {
    const findings = findingsByFile[file] || [];
    const findingWeight = findings.reduce(
      (sum, f) => sum + (SEV_WEIGHT[f.severity] || 0),
      0,
    );
    const blastRadius =
      (depGraph.blastRadius && depGraph.blastRadius[file]) || 0;
    const dependents = (depGraph.dependents && depGraph.dependents[file]) || [];
    const exposure = detectExposure(file);

    // internal cascade risk + direct external exposure, both amplifying
    // how bad the underlying findings already are
    const riskScore = findingWeight + blastRadius * 2 + exposure.score * 3;

    return {
      file,
      findings,
      findingCount: findings.length,
      findingWeight,
      blastRadius,
      dependents,
      exposureScore: exposure.score,
      exposureReasons: exposure.reasons,
      riskScore,
    };
  })
  .filter((f) => f.findingCount > 0 || f.blastRadius > 0 || f.exposureScore > 0)
  .sort((a, b) => b.riskScore - a.riskScore);

files.forEach((f, i) => (f.rank = i + 1));

const output = {
  generatedAt: new Date().toISOString(),
  scoring: {
    findingWeight: "high=3, medium=2, low=1, summed per file",
    blastRadius: "count of files that import this one, x2",
    exposureScore:
      "0-3, direct external reachability (HTTP server=3, routes=2, CLI/script entry=1), x3",
    riskScore: "findingWeight + blastRadius*2 + exposureScore*3",
  },
  files,
};

fs.writeFileSync(
  path.join(ROOT, "risk-data.json"),
  JSON.stringify(output, null, 2),
);

console.log("Risk ranking:");
files.forEach((f) => {
  console.log(
    `  #${f.rank}  ${f.file}  (score ${f.riskScore} = findings ${f.findingWeight} + blast ${f.blastRadius}x2 + exposure ${f.exposureScore}x3)`,
  );
  if (f.exposureReasons.length)
    console.log(`         exposed because: ${f.exposureReasons.join(", ")}`);
});
console.log("\nWrote risk-data.json");
