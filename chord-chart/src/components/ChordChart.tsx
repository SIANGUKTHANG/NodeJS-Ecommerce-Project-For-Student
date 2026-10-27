"use client";

import { formatNotation, progressionSummary } from "@/lib/format";
import type { AnalyzeResult } from "@/lib/types";

type Props = {
  result: AnalyzeResult;
  onChange?: (next: AnalyzeResult) => void;
};

const CHORD_OPTIONS = [
  "_",
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
  "Cm",
  "C#m",
  "Dm",
  "D#m",
  "Em",
  "Fm",
  "F#m",
  "Gm",
  "G#m",
  "Am",
  "A#m",
  "Bm",
];

export function ChordChart({ result, onChange }: Props) {
  const lines = formatNotation(result.bars, 4).split("\n");
  const summary = progressionSummary(result.bars);
  const editable = Boolean(result.editable && onChange);

  function updateBeat(barIndex: number, beatIndex: number, value: string) {
    if (!onChange) return;
    const bars = result.bars.map((bar, bi) =>
      bar.map((beat, bj) => (bi === barIndex && bj === beatIndex ? value : beat)),
    );
    onChange({
      ...result,
      bars,
      notation: formatNotation(bars, 4),
      progression: bars.map((bar) => bar.find((c) => c !== "_") ?? "_"),
      barCount: bars.length,
    });
  }

  function addBar() {
    if (!onChange) return;
    const bars = [...result.bars, ["_", "_", "_", "_"]];
    onChange({
      ...result,
      bars,
      notation: formatNotation(bars, 4),
      barCount: bars.length,
    });
  }

  return (
    <section className="chart-sheet" id="chord-sheet" aria-label="Chord chart">
      <header className="chart-sheet__head">
        <div>
          <p className="chart-sheet__kicker">Chord note</p>
          <h2 className="chart-sheet__title">{result.title}</h2>
          <p className="chart-sheet__meta">
            {result.artist}
            {result.bpm ? ` · ${Math.round(result.bpm)} BPM` : ""}
            {result.timeSignature ? ` · ${result.timeSignature}` : ""}
            {result.analyzedSeconds
              ? ` · first ${Math.round(result.analyzedSeconds)}s`
              : ""}
          </p>
        </div>
        {result.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="chart-sheet__thumb print-hide"
            src={result.thumbnailUrl}
            alt=""
            width={160}
            height={90}
          />
        ) : null}
      </header>

      {result.notice ? (
        <p className="chart-sheet__notice print-hide">{result.notice}</p>
      ) : null}

      <p className="chart-sheet__progression">
        <span>Progression</span> {summary}
      </p>

      <pre className="chart-sheet__notation" tabIndex={0}>
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </pre>

      {editable ? (
        <div className="chart-editor print-hide" aria-label="Edit chords">
          <p className="chart-editor__label">Edit beats</p>
          <div className="chart-editor__bars">
            {result.bars.map((bar, bi) => (
              <div className="chart-editor__bar" key={`bar-${bi}`}>
                <span className="chart-editor__bar-num">{bi + 1}</span>
                {bar.map((beat, bj) => (
                  <select
                    key={`b-${bi}-${bj}`}
                    className="chart-editor__select"
                    value={beat}
                    aria-label={`Bar ${bi + 1} beat ${bj + 1}`}
                    onChange={(e) => updateBeat(bi, bj, e.target.value)}
                  >
                    {CHORD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--ghost" onClick={addBar}>
            + Add bar
          </button>
        </div>
      ) : null}

      <p className="chart-sheet__hint print-hide">
        Format: each <code>|</code> is a bar · each slot is a beat ·{" "}
        <code>_</code> means hold the previous chord
      </p>
    </section>
  );
}
