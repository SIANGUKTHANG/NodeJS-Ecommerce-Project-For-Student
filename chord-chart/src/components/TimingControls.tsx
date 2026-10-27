"use client";

import type { AnalyzeResult } from "@/lib/types";
import { formatClock } from "@/lib/playback";

type Props = {
  result: AnalyzeResult;
  onChange: (next: AnalyzeResult) => void;
};

export function TimingControls({ result, onChange }: Props) {
  const offset = result.beatOffset ?? 0;
  const bpm = result.bpm;
  const analyzed = result.analyzedSeconds;
  const full = result.duration ?? result.durationSeconds ?? analyzed;
  const incomplete = result.complete === false;

  function nudgeBpm(delta: number) {
    const next = Math.min(200, Math.max(50, Math.round((bpm + delta) * 10) / 10));
    onChange({ ...result, bpm: next });
  }

  function nudgeOffset(deltaSec: number) {
    const beatDur = 60 / Math.max(bpm, 1);
    const next = Math.max(0, Math.min(beatDur * 0.99, offset + deltaSec));
    onChange({ ...result, beatOffset: Math.round(next * 1000) / 1000 });
  }

  function shiftBeat(dir: -1 | 1) {
    const beatDur = 60 / Math.max(bpm, 1);
    nudgeOffset(dir * beatDur);
  }

  return (
    <div className="timing-controls print-hide" aria-label="Tempo and timing">
      <div className="timing-controls__row">
        <span className="timing-controls__label">Tempo</span>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => nudgeBpm(-1)}
        >
          −1
        </button>
        <strong className="timing-controls__value">{Math.round(bpm)} BPM</strong>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => nudgeBpm(1)}
        >
          +1
        </button>
      </div>

      <div className="timing-controls__row">
        <span className="timing-controls__label">Sync</span>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => nudgeOffset(-0.05)}
          aria-label="Nudge timing earlier"
        >
          −50ms
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => shiftBeat(-1)}
          aria-label="Shift one beat earlier"
        >
          ← beat
        </button>
        <strong className="timing-controls__value">{offset.toFixed(2)}s</strong>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => shiftBeat(1)}
          aria-label="Shift one beat later"
        >
          beat →
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => nudgeOffset(0.05)}
          aria-label="Nudge timing later"
        >
          +50ms
        </button>
      </div>

      <p className="timing-controls__meta">
        Chart covers {formatClock(analyzed)}
        {full && full > analyzed + 0.5 ? ` of ~${formatClock(full)}` : ""} ·{" "}
        {result.timeSignature}
        {incomplete
          ? " · song was truncated — re-upload or raise analysis length"
          : " · full analyzed length"}
      </p>
      <p className="timing-controls__hint">
        If ♪ drifts from the groove, nudge Tempo or Sync while playing.
      </p>
    </div>
  );
}
