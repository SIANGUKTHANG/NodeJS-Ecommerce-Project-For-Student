"use client";

import type { ReactNode } from "react";
import {
  chordRuns,
  formatNotation,
  formatSimpleNotation,
  progressionSummary,
} from "@/lib/format";
import { beatToBarBeat, soundingChord } from "@/lib/playback";
import type { ChartMode } from "@/lib/pdf";
import { SECTION_OPTIONS, sectionAt, setSectionAt } from "@/lib/sections";
import {
  formatTransposeLabel,
  transposeBars,
} from "@/lib/transpose";
import type { AnalyzeResult } from "@/lib/types";

type Props = {
  result: AnalyzeResult;
  mode: ChartMode;
  onChange?: (next: AnalyzeResult) => void;
  playheadBeat?: number | null;
  isPlaying?: boolean;
  onSeekBeat?: (beatIndex: number) => void;
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

function renderGuitarSimple(
  result: AnalyzeResult,
  active: { bar: number; beat: number } | null,
  onSeekBeat?: (beatIndex: number) => void,
) {
  const runs = chordRuns(result.bars, result.sections);
  const nodes: ReactNode[] = [];
  let row: ReactNode[] = [];
  let rowKey = 0;

  function flushRow() {
    if (!row.length) return;
    nodes.push(
      <div className="guitar-row" key={`g-row-${rowKey++}`}>
        {row}
      </div>,
    );
    row = [];
  }

  for (const run of runs) {
    if (run.section) {
      flushRow();
      nodes.push(
        <div key={`sec-${run.startBar}`} className="chart-sheet__section">
          [{run.section}]
        </div>,
      );
    }
    const endBar = run.startBar + run.bars - 1;
    const isActive =
      active != null &&
      active.bar >= run.startBar &&
      active.bar <= endBar;
    row.push(
      <button
        key={`run-${run.startBar}`}
        type="button"
        className={`guitar-chord ${isActive ? "is-active" : ""}`}
        onClick={() => onSeekBeat?.(run.startBar * 4)}
        aria-label={`${run.chord} for ${run.bars} bar${run.bars > 1 ? "s" : ""}`}
      >
        {isActive ? (
          <span className="guitar-chord__note" aria-hidden="true">
            ♪
          </span>
        ) : null}
        <span className="guitar-chord__name">{run.chord}</span>
        <span className="guitar-chord__len">
          {run.bars} bar{run.bars > 1 ? "s" : ""}
        </span>
      </button>,
    );
    if (row.length >= 4) flushRow();
  }
  flushRow();
  return nodes;
}

export function ChordChart({
  result,
  mode,
  onChange,
  playheadBeat = null,
  isPlaying = false,
  onSeekBeat,
}: Props) {
  const summary = progressionSummary(result.bars);
  const editable = Boolean(result.editable && onChange && mode === "complex");
  const offset = result.transposeOffset ?? 0;
  const active =
    playheadBeat == null ? null : beatToBarBeat(playheadBeat);
  const activeChord =
    active && result.bars[active.bar]
      ? soundingChord(result.bars, active.bar, active.beat)
      : null;
  const simple = mode === "simple";

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
          <p className="chart-sheet__kicker">
            Chord note · {simple ? "Simple" : "Complex"}
          </p>
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
        {activeChord && activeChord !== "_" ? (
          <span className="chart-sheet__now print-hide">
            {" "}
            · now <strong>♪ {activeChord}</strong>
          </span>
        ) : null}
      </p>

      <div
        className={`chart-live ${isPlaying ? "is-playing" : ""} ${simple ? "chart-live--simple" : ""}`}
        aria-label="Chord bars with playhead"
      >
        {simple
          ? renderGuitarSimple(result, active, onSeekBeat)
          : result.bars.map((bar, bi) => {
              const label = sectionAt(result.sections, bi);
              return (
                <div key={`live-bar-${bi}`}>
                  {label ? (
                    <div className="chart-sheet__section">[{label}]</div>
                  ) : null}
                  <div className="chart-live__bar">
                    <span className="chart-live__pipe" aria-hidden="true">
                      |
                    </span>
                    {bar.map((token, bj) => {
                      const absoluteBeat = bi * 4 + bj;
                      const isActive =
                        active != null &&
                        active.bar === bi &&
                        active.beat === bj;
                      return (
                        <button
                          key={`live-${bi}-${bj}`}
                          type="button"
                          className={`chart-live__beat ${isActive ? "is-active" : ""}`}
                          onClick={() => onSeekBeat?.(absoluteBeat)}
                          aria-label={`Bar ${bi + 1} beat ${bj + 1}: ${token}`}
                        >
                          {isActive ? (
                            <span className="chart-live__note" aria-hidden="true">
                              ♪
                            </span>
                          ) : null}
                          <span className="chart-live__token">{token}</span>
                        </button>
                      );
                    })}
                    <span className="chart-live__pipe" aria-hidden="true">
                      |
                    </span>
                  </div>
                </div>
              );
            })}
      </div>

      <pre className="chart-sheet__notation chart-sheet__notation--print">
        {simple
          ? formatSimpleNotation(result.bars, 4, result.sections)
          : formatNotation(result.bars, 4, result.sections)}
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
                    {bar.map((beat, bj) => {
                      const absoluteBeat = bi * 4 + bj;
                      const isActive =
                        active != null &&
                        active.bar === bi &&
                        active.beat === bj;
                      return (
                        <select
                          key={`b-${bi}-${bj}`}
                          className={`chart-editor__select ${isActive ? "is-active" : ""}`}
                          value={beat}
                          aria-label={`Bar ${bi + 1} beat ${bj + 1}`}
                          onChange={(e) => updateBeat(bi, bj, e.target.value)}
                          onFocus={() => onSeekBeat?.(absoluteBeat)}
                        >
                          {CHORD_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      );
                    })}
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
        {simple
          ? "Simple mood: hold each chord for the shown bars — easy for guitar"
          : "Complex mood: every beat · _ means keep holding the same chord"}
      </p>
    </section>
  );
}
