import type { SectionMarker } from "./types";

export const SECTION_OPTIONS = [
  "",
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Solo",
  "Instrumental",
  "Outro",
] as const;

/** Sensible starter labels based on chart length. */
export function defaultSections(barCount: number): SectionMarker[] {
  if (barCount <= 0) return [];
  if (barCount === 1) return [{ barIndex: 0, name: "Intro" }];

  const picks: SectionMarker[] = [{ barIndex: 0, name: "Intro" }];

  if (barCount >= 3) {
    picks.push({ barIndex: Math.min(2, barCount - 1), name: "Verse" });
  }
  if (barCount >= 5) {
    picks.push({ barIndex: Math.min(4, barCount - 1), name: "Chorus" });
  }
  if (barCount >= 9) {
    picks.push({ barIndex: Math.min(8, barCount - 1), name: "Verse" });
  }
  if (barCount >= 13) {
    picks.push({ barIndex: Math.min(12, barCount - 1), name: "Chorus" });
  }
  if (barCount >= 8) {
    const outroAt = Math.max(barCount - 2, picks[picks.length - 1]?.barIndex ?? 0);
    if (!picks.some((p) => p.barIndex === outroAt)) {
      picks.push({ barIndex: outroAt, name: "Outro" });
    }
  }

  // Keep first label per bar index
  const seen = new Set<number>();
  return picks.filter((p) => {
    if (p.barIndex < 0 || p.barIndex >= barCount) return false;
    if (seen.has(p.barIndex)) return false;
    seen.add(p.barIndex);
    return true;
  });
}

export function sectionAt(
  sections: SectionMarker[] | undefined,
  barIndex: number,
): string | null {
  if (!sections?.length) return null;
  const hit = sections.find((s) => s.barIndex === barIndex);
  return hit?.name || null;
}

export function setSectionAt(
  sections: SectionMarker[] | undefined,
  barIndex: number,
  name: string,
): SectionMarker[] {
  const next = (sections || []).filter((s) => s.barIndex !== barIndex);
  if (name) next.push({ barIndex, name });
  return next.sort((a, b) => a.barIndex - b.barIndex);
}
