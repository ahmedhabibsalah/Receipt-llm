export type Severity = "high" | "medium" | "low";

export interface Finding {
  file: string;
  id: string;
  severity: Severity;
  issue: string;
  description: string;
  fix: string;
  line: number;
  patch?: {
    before: string;
    after: string;
    generatedByBob: boolean;
  };
}

export interface FileRisk {
  file: string;
  findings: Finding[];
  findingCount: number;
  findingWeight: number;
  blastRadius: number;
  dependents: string[];
  exposureScore: number;
  exposureReasons: string[];
  riskScore: number;
  rank: number;
}

export interface RiskData {
  generatedAt: string;
  scoring: {
    findingWeight: string;
    blastRadius: string;
    exposureScore: string;
    riskScore: string;
  };
  files: FileRisk[];
}

export interface DepEdge {
  from: string;
  to: string;
  kind: "require" | "import" | "spawn";
}

export interface DepGraph {
  generatedAt: string;
  fileCount: number;
  edgeCount: number;
  edges: DepEdge[];
  dependents: Record<string, string[]>;
  blastRadius: Record<string, number>;
}
