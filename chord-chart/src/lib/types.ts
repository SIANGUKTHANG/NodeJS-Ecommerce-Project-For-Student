export type ChordBar = string[];

export type AnalyzeResult = {
  ok: true;
  videoId: string | null;
  title: string;
  artist: string;
  url: string | null;
  duration: number | null;
  bpm: number;
  timeSignature: string;
  analyzedSeconds: number;
  bars: string[][];
  notation: string;
  progression: string[];
  barCount: number;
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
