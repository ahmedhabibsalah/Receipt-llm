import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { FileRisk, DepEdge } from "../lib/types";

interface Props {
  files: FileRisk[];
  edges: DepEdge[];
  selectedFile: string | null;
  onSelect: (file: string | null) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  riskScore: number;
  blastRadius: number;
  exposureScore: number;
  dominant: "high" | "medium" | "low" | "none";
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  kind: string;
}

const SEV_HEX: Record<string, string> = {
  high: "#F2545B",
  medium: "#F2A65A",
  low: "#57C7FF",
  none: "#3A4552",
};

const W = 1000;
const H = 420;

function dominantSeverity(f: FileRisk): SimNode["dominant"] {
  const counts = { high: 0, medium: 0, low: 0 };
  f.findings.forEach(x => counts[x.severity]++);
  if (counts.high > 0) return "high";
  if (counts.medium > 0) return "medium";
  if (counts.low > 0) return "low";
  return "none";
}

function radiusFor(f: SimNode) {
  return 10 + Math.sqrt(Math.max(0, f.riskScore)) * 2.6;
}

export default function DependencyGraph({ files, edges, selectedFile, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const nodes: SimNode[] = files.map(f => ({
      id: f.file,
      riskScore: f.riskScore,
      blastRadius: f.blastRadius,
      exposureScore: f.exposureScore,
      dominant: dominantSeverity(f),
    }));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links: SimLink[] = edges
      .filter(e => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map(e => ({ source: e.from, target: e.to, kind: e.kind }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 2.5])
        .on("zoom", event => container.attr("transform", event.transform))
    );

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).id(d => d.id).distance(110).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide<SimNode>(d => radiusFor(d) + 14));

    const link = container
      .append("g")
      .attr("stroke", "#2A3542")
      .attr("stroke-width", 1.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-dasharray", d => (d.kind === "spawn" ? "3,3" : null));

    const node = container
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("click", (_event, d) => onSelect(selectedFile === d.id ? null : d.id));

    node
      .append("circle")
      .attr("r", d => radiusFor(d))
      .attr("fill", d => SEV_HEX[d.dominant])
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#0B0F14")
      .attr("stroke-width", 2);

    node
      .filter(d => d.exposureScore > 0)
      .append("circle")
      .attr("r", d => radiusFor(d) + 5)
      .attr("fill", "none")
      .attr("stroke", "#6C8EF5")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "2,3");

    node
      .append("text")
      .text(d => d.id.split("/").pop() ?? d.id)
      .attr("text-anchor", "middle")
      .attr("dy", d => radiusFor(d) + 14)
      .attr("font-size", 10)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("fill", "#8B98A5")
      .style("pointer-events", "none");

    node.append("title").text(d => `${d.id}\nrisk ${d.riskScore} · blast radius ${d.blastRadius}`);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimNode).x ?? 0)
        .attr("y1", d => (d.source as SimNode).y ?? 0)
        .attr("x2", d => (d.target as SimNode).x ?? 0)
        .attr("y2", d => (d.target as SimNode).y ?? 0);
      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [files, edges]);

  // selection highlight pass, separate effect so drag/simulation isn't rebuilt on select
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, SimNode>("g > g > g").each(function (d: any) {
      if (!d?.id) return;
      const related =
        !selectedFile ||
        d.id === selectedFile ||
        edges.some(e => (e.from === selectedFile && e.to === d.id) || (e.to === selectedFile && e.from === d.id));
      d3.select(this).attr("opacity", related ? 1 : 0.25);
    });
  }, [selectedFile, edges]);

  return (
    <div className="graph-panel">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="dep-graph" role="img" aria-label="Import dependency graph between scanned files">
      </svg>
      <p className="graph-note">
        Node size is risk score. Dashed rings mark directly exposed files. Dashed edges are process spawns (e.g. Node calling Python), not imports. Drag to rearrange, scroll to zoom.
      </p>
    </div>
  );
}
