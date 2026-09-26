import { useMemo, useState } from "react";
import { useRiskData } from "./lib/useRiskData";
import Treemap from "./components/Treemap";
import DependencyGraph from "./components/DependencyGraph";
import FindingsPanel from "./components/FindingsPanel";
import type { Severity } from "./lib/types";
import "./App.css";

type View = "map" | "graph";
type SevFilter = "all" | Severity;

function shortBase(p: string) {
  return p.split("/").pop() ?? p;
}

export default function App() {
  const { riskData, depGraph, loading, error } = useRiskData();
  const [view, setView] = useState<View>("map");
  const [severity, setSeverity] = useState<SevFilter>("all");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const allFindings = useMemo(
    () => (riskData ? riskData.files.flatMap(f => f.findings) : []),
    [riskData]
  );

  const sevCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    allFindings.forEach(f => c[f.severity]++);
    return c;
  }, [allFindings]);

  const filteredFindings = useMemo(() => {
    let list = allFindings;
    if (severity !== "all") list = list.filter(f => f.severity === severity);
    if (selectedFile) list = list.filter(f => f.file === selectedFile);
    return list;
  }, [allFindings, severity, selectedFile]);

  if (loading) return <div className="status">Loading risk data…</div>;
  if (error || !riskData || !depGraph) {
    return (
      <div className="status error">
        Couldn't load risk-data.json / dep-graph.json. Run <code>node dep-graph.js</code> then{" "}
        <code>node merge-risk.js</code> in the repo root, and copy both JSON files into{" "}
        <code>dashboard/public/</code>.
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="top">
        <div className="wordmark">Review Coach <span>/ receipt-llm</span></div>
      </header>
      <p className="sub">
        Findings from IBM Bob, weighted by real blast radius and direct exposure — not just Bob's opinion of severity.
      </p>

      <div className="stats">
        <div className="stat"><span className="n">{allFindings.length}</span><span className="l">findings</span></div>
        <div className="stat"><span className="n">{riskData.files.length}</span><span className="l">files scored</span></div>
        <div className="stat"><span className="n">{depGraph.edgeCount}</span><span className="l">dependency edges</span></div>
        <div className="legend">
          <span className="item"><span className="dot" style={{ background: "var(--high)" }} />High {sevCounts.high}</span>
          <span className="item"><span className="dot" style={{ background: "var(--medium)" }} />Medium {sevCounts.medium}</span>
          <span className="item"><span className="dot" style={{ background: "var(--low)" }} />Low {sevCounts.low}</span>
        </div>
      </div>

      <div className="view-tabs">
        <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Risk map</button>
        <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}>Dependency graph</button>
      </div>

      {view === "map" ? (
        <Treemap files={riskData.files} selectedFile={selectedFile} onSelect={setSelectedFile} />
      ) : (
        <DependencyGraph files={riskData.files} edges={depGraph.edges} selectedFile={selectedFile} onSelect={setSelectedFile} />
      )}

      <div className="board">
        <aside className="sidebar">
          <div>
            <h2 className="section">Severity</h2>
            <div className="chips">
              {(["all", "high", "medium", "low"] as SevFilter[]).map(s => (
                <button key={s} className={`chip${severity === s ? " active" : ""}`} onClick={() => setSeverity(s)}>
                  <span>{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</span>
                  <span className="cnt">{s === "all" ? allFindings.length : sevCounts[s as Severity]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="section">Files, by risk</h2>
            <div className="filelist">
              {riskData.files.map(f => (
                <button
                  key={f.file}
                  className={`fitem${selectedFile === f.file ? " active" : ""}`}
                  title={f.file}
                  onClick={() => setSelectedFile(selectedFile === f.file ? null : f.file)}
                >
                  <span>{shortBase(f.file)}</span>
                  <span className="cnt">{f.riskScore}</span>
                </button>
              ))}
            </div>
            {selectedFile && (
              <button className="clearfile" onClick={() => setSelectedFile(null)}>Show all files</button>
            )}
          </div>
        </aside>

        <main>
          <FindingsPanel
            findings={filteredFindings}
            title={selectedFile ? shortBase(selectedFile) : "All findings"}
          />
        </main>
      </div>

      <footer>
        <span>Built with IBM Bob 2.0 for the IBM Bob 2.0 Hackathon.</span>
        <span>Risk score = findings + blast radius × 2 + exposure × 3</span>
      </footer>
    </div>
  );
}
