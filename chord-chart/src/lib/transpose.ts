const NOTES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const ENHARMONIC: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B",
  "E#": "F",
  "B#": "C",
};

/** Transpose a single chord token like C, Am, F#, _  by semitones. */
export function transposeChord(chord: string, semitones: number): string {
  if (!chord || chord === "_") return chord;
  const match = chord.match(/^([A-G][b#]?)(.*)$/);
  if (!match) return chord;
  let root = match[1];
  const suffix = match[2] ?? "";
  root = ENHARMONIC[root] || root;
  const idx = NOTES_SHARP.indexOf(root as (typeof NOTES_SHARP)[number]);
  if (idx < 0) return chord;
  const next = (idx + ((semitones % 12) + 12)) % 12;
  return `${NOTES_SHARP[next]}${suffix}`;
}

export function transposeBars(bars: string[][], semitones: number): string[][] {
  if (semitones === 0) return bars;
  return bars.map((bar) => bar.map((beat) => transposeChord(beat, semitones)));
}

export function formatTransposeLabel(offset: number): string {
  if (offset === 0) return "Original key";
  return offset > 0 ? `+${offset}` : `${offset}`;
}
