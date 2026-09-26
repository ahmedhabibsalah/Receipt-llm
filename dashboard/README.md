# Review Coach dashboard

React + TypeScript + D3, reads `risk-data.json` and `dep-graph.json` and renders:

- **Risk map** — treemap sized by a real risk score (findings + blast radius × 2 + exposure × 3), tile fill shows the file's actual severity mix.
- **Dependency graph** — force-directed graph of real `require`/`import`/`spawn` relationships between files, draggable, zoomable.
- **Findings panel** — expandable list, shows Bob's description and fix, and a real before/after diff when a patch has been generated.

## Setup

```bash
npm install
npm run dev
```

## Refreshing the data

The dashboard reads static JSON from `public/`. To update it after re-running Bob or changing the repo:

```bash
# from the repo root (one level up from dashboard/)
node dep-graph.js
node merge-risk.js
cp dep-graph.json dashboard/public/dep-graph.json
cp risk-data.json dashboard/public/risk-data.json
```

## Build

```bash
npm run build
```

Outputs to `dist/`.
