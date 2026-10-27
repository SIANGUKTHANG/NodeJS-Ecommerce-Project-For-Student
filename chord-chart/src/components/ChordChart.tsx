"use client";

import { formatNotation, progressionSummary } from "@/lib/format";
import { SECTION_OPTIONS, setSectionAt } from "@/lib/sections";
import {
  formatTransposeLabel,
  transposeBars,
} from "@/lib/transpose";
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

function withNotation(result: AnalyzeResult, bars: string[][]): AnalyzeResult {
  return {
    ...result,
    bars,
    notation: formatNotation(bars, 4, result.sections),
    progression: bars.map((bar) => bar.find((c) => c !== "_") ?? "_"),
    barCount: bars.length,
  };
}

export function ChordChart({ result, onChange }: Props) {
  const lines = formatNotation(result.bars, 4, result.sections).split("\n");
  const summary = progressionSummary(result.bars);
  const editable = Boolean(result.editable && onChange);
  const offset = result.transposeOffset ?? 0;

  function updateBeat(barIndex: number, beatIndex: number, value: string) {
    if (!onChange) return;
    const bars = result.bars.map((bar, bi) =>
      bar.map((beat, bj) => (bi === barIndex && bj === beatIndex ? value : beat)),
    );
    onChange(withNotation(result, bars));
  }

  function updateSection(barIndex: number, name: string) {
    if (!onChange) return;
    const sections = setSectionAt(result.sections, barIndex, name);
    const next = { ...result, sections };
    onChange({
      ...next,
      notation: formatNotation(next.bars, 4, sections),
    });
  }

  function addBar() {
    if (!onChange) return;
    const bars = [...result.bars, ["_", "_", "_", "_"]];
    onChange(withNotation(result, bars));
  }

  function transpose(semitones: number) {
    if (!onChange || semitones === 0) return;
    const bars = transposeBars(result.bars, semitones);
    onChange({
      ...withNotation(result, bars),
      transposeOffset: offset + semitones,
    });
  }

  function resetTranspose() {
    if (!onChange || offset === 0) return;
    const bars = transposeBars(result.bars, -offset);
    onChange({
      ...withNotation(result, bars),
      transposeOffset: 0,
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
            {offset !== 0 ? ` · transpose ${formatTransposeLabel(offset)}` : ""}
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

      <div className="transpose-bar print-hide" role="group" aria-label="Transpose">
        <span className="transpose-bar__label">Transpose</span>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => transpose(-1)}
          disabled={!onChange}
          aria-label="Transpose down one semitone"
        >
          −1
        </button>
        <span className="transpose-bar__value">{formatTransposeLabel(offset)}</span>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={() => transpose(1)}
          disabled={!onChange}
          aria-label="Transpose up one semitone"
        >
          +1
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--compact"
          onClick={resetTranspose}
          disabled={!onChange || offset === 0}
        >
          Reset
        </button>
      </div>

      <p className="chart-sheet__progression">
        <span>Progression</span> {summary}
      </p>

      <pre className="chart-sheet__notation" tabIndex={0}>
        {lines.map((line, idx) =>
          line.startsWith("[") && line.endsWith("]") ? (
            <div key={`${line}-${idx}`} className="chart-sheet__section">
              {line}
            </div>
          ) : (
            <div key={`${line}-${idx}`}>{line}</div>
          ),
        )}
      </pre>

      {editable ? (
        <div className="chart-editor print-hide" aria-label="Edit chords">
          <p className="chart-editor__label">Edit sections & beats</p>
          <div className="chart-editor__bars">
            {result.bars.map((bar, bi) => {
              const sectionName =
                result.sections?.find((s) => s.barIndex === bi)?.name || "";
              return (
                <div className="chart-editor__row" key={`bar-${bi}`}>
                  <div className="chart-editor__section">
                    <span className="chart-editor__bar-num">{bi + 1}</span>
                    <select
                      className="chart-editor__select chart-editor__select--section"
                      value={sectionName}
                      aria-label={`Section label for bar ${bi + 1}`}
                      onChange={(e) => updateSection(bi, e.target.value)}
                    >
                      {SECTION_OPTIONS.map((opt) => (
                        <option key={opt || "none"} value={opt}>
                          {opt || "— section —"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="chart-editor__bar">
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
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn--ghost" onClick={addBar}>
            + Add bar
          </button>
        </div>
      ) : null}

      <p className="chart-sheet__hint print-hide">
        Labels mark <code>[Intro]</code> / <code>[Verse]</code> /{" "}
        <code>[Chorus]</code> · <code>|</code> = bar · <code>_</code> = hold
      </p>
    </section>
  );
}
