/** Convert playback time (seconds) → absolute beat index (0-based). */
export function timeToBeat(
  timeSec: number,
  bpm: number,
  beatOffset = 0,
): number {
  if (!Number.isFinite(timeSec) || !bpm) return 0;
  const rel = timeSec - beatOffset;
  if (rel < 0) return 0;
  return Math.floor((rel * bpm) / 60);
}

/** Convert beat index → start time in seconds. */
export function beatToTime(
  beatIndex: number,
  bpm: number,
  beatOffset = 0,
): number {
  if (!bpm) return beatOffset;
  return beatOffset + (Math.max(0, beatIndex) * 60) / bpm;
}

export function clampBeat(
  beatIndex: number,
  barCount: number,
  beatsPerBar = 4,
): number {
  const max = Math.max(0, barCount * beatsPerBar - 1);
  return Math.min(Math.max(0, beatIndex), max);
}

export function beatToBarBeat(
  beatIndex: number,
  beatsPerBar = 4,
): { bar: number; beat: number } {
  return {
    bar: Math.floor(beatIndex / beatsPerBar),
    beat: beatIndex % beatsPerBar,
  };
}

/** Effective chord sounding on a beat (resolve holds). */
export function soundingChord(bars: string[][], bar: number, beat: number): string {
  for (let bi = bar; bi >= 0; bi--) {
    const start = bi === bar ? beat : (bars[bi]?.length ?? 1) - 1;
    for (let bj = start; bj >= 0; bj--) {
      const c = bars[bi]?.[bj];
      if (c && c !== "_") return c;
    }
  }
  return "_";
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
