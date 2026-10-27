import type { ChordBar } from "./types";

/** Format bars as: |C _ _ _ | G _ _ _ | Am _ _ _ | F _ _ _ | */
export function formatNotation(bars: ChordBar[], barsPerLine = 4): string {
  const lines: string[] = [];
  for (let i = 0; i < bars.length; i += barsPerLine) {
    const chunk = bars.slice(i, i + barsPerLine);
    const line = chunk.map((bar) => `|${bar.join(" ")} `).join("") + "|";
    lines.push(line);
  }
  return lines.join("\n");
}

export function progressionSummary(bars: ChordBar[]): string {
  const roots = bars.map((bar) => bar.find((c) => c !== "_") ?? "_");
  // collapse consecutive duplicates for a short summary
  const compact: string[] = [];
  for (const c of roots) {
    if (c === "_") continue;
    if (compact[compact.length - 1] !== c) compact.push(c);
  }
  return compact.join(" – ") || "—";
}
