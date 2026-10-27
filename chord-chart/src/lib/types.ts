export type ChordBar = string[];

export type SectionMarker = {
  /** 0-based bar index where this section starts */
  barIndex: number;
  name: string;
};

export type AnalyzeResult = {
  ok: true;
  videoId: string | null;
  title: string;
  artist: string;
  url: string | null;
  duration: number | null;
  bpm: number;
  /** Seconds from audio start to beat 0 / downbeat */
  beatOffset?: number;
  beatsPerBar?: number;
  timeSignature: string;
  analyzedSeconds: number;
  durationSeconds?: number;
  /** False when analysis was truncated before full song length */
  complete?: boolean;
  bars: string[][];
  notation: string;
  progression: string[];
  barCount: number;
  sections?: SectionMarker[];
  /** Cumulative transpose in semitones from the analyzed original */
  transposeOffset?: number;
  thumbnailUrl?: string;
  source?: "youtube" | "youtube-manual" | "upload" | "demo";
  editable?: boolean;
  notice?: string;
};

export type AnalyzeError = {
  ok: false;
  error: string;
};

export type AnalyzeResponse = AnalyzeResult | AnalyzeError;
