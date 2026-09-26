import { useMemo } from "react";
import * as d3 from "d3";
import type { FileRisk } from "../lib/types";

interface Props {
  files: FileRisk[];
  selectedFile: string | null;
  onSelect: (file: string | null) => void;
}

const SEV_HEX = { high: "#F2545B", medium: "#F2A65A", low: "#57C7FF" };
const W = 1000;
const H = 340;

function shortName(p: string) {
  const parts = p.split("/");
  return { dir: parts.slice(0, -1).join("/"), base: parts[parts.length - 1] };
}

export default function Treemap({ files, selectedFile, onSelect }: Props) {
  const leaves = useMemo(() => {
    const root = d3
      .hierarchy<{ children: FileRisk[] }>({ children: files } as any)
      .sum((d: any) => d.riskScore ?? 0);
    d3.treemap<any>().size([W, H]).paddingInner(4).round(true)(root as any);
    return (root.leaves() as any[]).filter(d => d.x1 - d.x0 > 0.5 && d.y1 - d.y0 > 0.5);
  }, [files]);

  return (
    <div className="treemap-panel">
      <svg
        className="treemap"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Risk map of scanned files, sized by combined finding severity, blast radius, and exposure"
      >
        {leaves.map((d, i) => {
          const data: FileRisk = d.data;
          const tw = d.x1 - d.x0;
          const th = d.y1 - d.y0;
          const { high, medium, low } = data.findings.reduce(
            (acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }),
            { high: 0, medium: 0, low: 0 } as Record<string, number>
          );
          const total = Math.max(1, high + medium + low);
          const hPct = (high / total) * 100;
          const mPct = (medium / total) * 100;
          const { dir, base } = shortName(data.file);
          const gradId = `grad-${i}`;
          const isSelected = selectedFile === data.file;

          return (
            <g
              key={data.file}
              transform={`translate(${d.x0},${d.y0})`}
              className={`tile${isSelected ? " selected" : ""}`}
              onClick={() => onSelect(isSelected ? null : data.file)}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(isSelected ? null : data.file); }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SEV_HEX.high} />
                  <stop offset={`${hPct}%`} stopColor={SEV_HEX.high} />
                  <stop offset={`${hPct}%`} stopColor={SEV_HEX.medium} />
                  <stop offset={`${hPct + mPct}%`} stopColor={SEV_HEX.medium} />
                  <stop offset={`${hPct + mPct}%`} stopColor={SEV_HEX.low} />
                  <stop offset="100%" stopColor={SEV_HEX.low} />
                </linearGradient>
              </defs>
              <rect className="tile-bg" width={tw} height={th} rx={4} fill={`url(#${gradId})`} />
              {data.exposureScore > 0 && tw > 30 && th > 20 && (
                <circle cx={tw - 12} cy={12} r={4} className="exposure-dot">
                  <title>Directly exposed: {data.exposureReasons.join(", ")}</title>
                </circle>
              )}
              {tw > 70 && th > 40 && (
                <>
                  <text className="fdir" x={8} y={16} fontSize={9}>
                    {dir.length > 18 ? dir.slice(0, 16) + "…" : dir}
                  </text>
                  <text className="fname" x={8} y={30} fontSize={12}>{base}</text>
                </>
              )}
              {tw <= 70 && tw > 34 && th > 20 && (
                <text className="fname" x={6} y={16} fontSize={10}>
                  {base.length > 12 ? base.slice(0, 10) + "…" : base}
                </text>
              )}
              {tw > 34 && th > 34 && (
                <text className="fscore" x={tw - 8} y={th - 8} textAnchor="end" fontSize={14}>
                  {data.riskScore}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="treemap-note">
        Tile size is risk score (findings + blast radius × 2 + exposure × 3). The small dot marks files reachable directly from outside the codebase.
      </p>
    </div>
  );
}
