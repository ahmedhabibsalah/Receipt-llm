import { useEffect, useState } from "react";
import type { RiskData, DepGraph } from "./types";

interface State {
  riskData: RiskData | null;
  depGraph: DepGraph | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads risk-data.json (Bob's findings + blast radius + exposure, merged
 * and scored by merge-risk.js) and dep-graph.json (the raw edge list,
 * needed for the dependency-graph visualization) from /public.
 *
 * These are static files dropped in by the build scripts, not an API —
 * see scripts/dep-graph.js and scripts/merge-risk.js in the repo root.
 */
export function useRiskData(): State {
  const [state, setState] = useState<State>({
    riskData: null,
    depGraph: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const injected = (window as any).__RISK_DATA__;
    const injectedGraph = (window as any).__DEP_GRAPH__;
    if (injected && injectedGraph) {
      setState({ riskData: injected, depGraph: injectedGraph, loading: false, error: null });
      return;
    }

    let cancelled = false;

    Promise.all([
      fetch("/risk-data.json").then(r => {
        if (!r.ok) throw new Error(`risk-data.json: ${r.status}`);
        return r.json();
      }),
      fetch("/dep-graph.json").then(r => {
        if (!r.ok) throw new Error(`dep-graph.json: ${r.status}`);
        return r.json();
      }),
    ])
      .then(([riskData, depGraph]) => {
        if (!cancelled) setState({ riskData, depGraph, loading: false, error: null });
      })
      .catch(err => {
        if (!cancelled) setState({ riskData: null, depGraph: null, loading: false, error: err.message });
      });

    return () => { cancelled = true; };
  }, []);

  return state;
}
