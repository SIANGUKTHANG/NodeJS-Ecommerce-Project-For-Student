/** Convert playback time (seconds) → absolute beat index (0-based). */
export function timeToBeat(timeSec: number, bpm: number): number {
  if (!Number.isFinite(timeSec) || timeSec < 0 || !bpm) return 0;
  return Math.floor((timeSec * bpm) / 60);
}

/** Convert beat index → start time in seconds. */
export function beatToTime(beatIndex: number, bpm: number): number {
  if (!bpm) return 0;
  return (Math.max(0, beatIndex) * 60) / bpm;
}

export function clampBeat(beatIndex: number, barCount: number): number {
  const max = Math.max(0, barCount * 4 - 1);
  return Math.min(Math.max(0, beatIndex), max);
}

export function beatToBarBeat(beatIndex: number): { bar: number; beat: number } {
  return {
    bar: Math.floor(beatIndex / 4),
    beat: beatIndex % 4,
  };
}

/** Effective chord sounding on a beat (resolve holds). */
export function soundingChord(bars: string[][], bar: number, beat: number): string {
  for (let bi = bar; bi >= 0; bi--) {
    const start = bi === bar ? beat : 3;
    for (let bj = start; bj >= 0; bj--) {
      const c = bars[bi]?.[bj];
      if (c && c !== "_") return c;
    }
  }
  return "_";
}
