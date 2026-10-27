import type { ChordBar, SectionMarker } from "./types";
import { sectionAt } from "./sections";

/** One chord per bar (first non-hold), for simple / guitar mode. */
export function barChord(bar: ChordBar, fallback = "_"): string {
  return bar.find((c) => c !== "_") ?? fallback;
}

export type ChordRun = {
  chord: string;
  startBar: number;
  bars: number;
  section?: string | null;
};

/** Collapse consecutive same-bar chords into guitar-friendly runs. */
export function chordRuns(
  bars: ChordBar[],
  sections?: SectionMarker[],
): ChordRun[] {
  const runs: ChordRun[] = [];
  for (let i = 0; i < bars.length; i++) {
    const chord = barChord(bars[i]);
    if (chord === "_") continue;
    const section = sectionAt(sections, i);
    const prev = runs[runs.length - 1];
    if (prev && prev.chord === chord && !section) {
      prev.bars += 1;
    } else {
      runs.push({ chord, startBar: i, bars: 1, section: section || null });
    }
  }
  return runs;
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

/**
 * Guitar simple mode: chord changes with bar counts
 * [Verse]
 * C ×2   G ×2   Am ×1   F ×1
 */
export function formatSimpleNotation(
  bars: ChordBar[],
  barsPerLine = 4,
  sections?: SectionMarker[],
): string {
  void barsPerLine;
  const runs = chordRuns(bars, sections);
  const lines: string[] = [];
  let row: string[] = [];
  for (const run of runs) {
    if (run.section) {
      if (row.length) {
        lines.push(row.join("   "));
        row = [];
      }
      lines.push(`[${run.section}]`);
    }
    row.push(run.bars > 1 ? `${run.chord} ×${run.bars}` : run.chord);
    if (row.length >= 4) {
      lines.push(row.join("   "));
      row = [];
    }
  }
  if (row.length) lines.push(row.join("   "));
  return lines.join("\n") || "—";
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
