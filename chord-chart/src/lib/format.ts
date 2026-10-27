import type { ChordBar, SectionMarker } from "./types";
import { sectionAt } from "./sections";

/** One chord per bar (first non-hold), for simple mode. */
export function barChord(bar: ChordBar, fallback = "_"): string {
  return bar.find((c) => c !== "_") ?? fallback;
}

/** Format bars as: |C _ _ _ | G _ _ _ | … with [Intro]/[Verse] labels */
export function formatNotation(
  bars: ChordBar[],
  barsPerLine = 4,
  sections?: SectionMarker[],
): string {
  const lines: string[] = [];
  let i = 0;
  while (i < bars.length) {
    const label = sectionAt(sections, i);
    if (label) lines.push(`[${label}]`);

    let end = Math.min(i + barsPerLine, bars.length);
    for (let j = i + 1; j < end; j++) {
      if (sectionAt(sections, j)) {
        end = j;
        break;
      }
    }

    const chunk = bars.slice(i, end);
    lines.push(chunk.map((bar) => `|${bar.join(" ")} `).join("") + "|");
    i = end;
  }
  return lines.join("\n");
}

/** Simple mode: one chord per bar — |C | G | Am | F | */
export function formatSimpleNotation(
  bars: ChordBar[],
  barsPerLine = 4,
  sections?: SectionMarker[],
): string {
  const lines: string[] = [];
  let i = 0;
  while (i < bars.length) {
    const label = sectionAt(sections, i);
    if (label) lines.push(`[${label}]`);

    let end = Math.min(i + barsPerLine, bars.length);
    for (let j = i + 1; j < end; j++) {
      if (sectionAt(sections, j)) {
        end = j;
        break;
      }
    }

    const chunk = bars.slice(i, end);
    lines.push(chunk.map((bar) => `|${barChord(bar)} `).join("") + "|");
    i = end;
  }
  return lines.join("\n");
}

export function progressionSummary(bars: ChordBar[]): string {
  const roots = bars.map((bar) => barChord(bar));
  const compact: string[] = [];
  for (const c of roots) {
    if (c === "_") continue;
    if (compact[compact.length - 1] !== c) compact.push(c);
  }
  return compact.join(" – ") || "—";
}
