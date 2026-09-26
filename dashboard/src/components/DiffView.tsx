interface Props {
  before: string;
  after: string;
}

/**
 * Minimal line-level diff. Good enough for short, targeted patches
 * (a few lines around one finding) — not a general-purpose diff engine.
 * Lines present only in "before" render as removed, only in "after" as
 * added, everything else as context.
 */
function diffLines(before: string, after: string) {
  const b = before.split("\n");
  const a = after.split("\n");
  const bSet = new Map<string, number>();
  b.forEach((l, i) => bSet.set(l, i));

  const rows: { type: "context" | "add" | "remove"; text: string }[] = [];
  const bRemaining = new Set(b);
  const aRemaining = new Set(a);

  b.forEach(line => {
    if (!aRemaining.has(line)) rows.push({ type: "remove", text: line });
  });
  a.forEach(line => {
    if (!bRemaining.has(line)) rows.push({ type: "add", text: line });
    else if (aRemaining.has(line)) rows.push({ type: "context", text: line });
  });
  return rows;
}

export default function DiffView({ before, after }: Props) {
  const rows = diffLines(before, after);
  return (
    <div className="diff-view">
      {rows.map((r, i) => (
        <div key={i} className={`diff-row ${r.type}`}>
          <span className="diff-marker">{r.type === "add" ? "+" : r.type === "remove" ? "\u2212" : " "}</span>
          <span className="diff-text">{r.text || " "}</span>
        </div>
      ))}
    </div>
  );
}
