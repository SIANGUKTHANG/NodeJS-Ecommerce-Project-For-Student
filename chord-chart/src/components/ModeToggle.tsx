"use client";

import type { ChartMode } from "@/lib/pdf";

type Props = {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
};

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mode-toggle print-hide" role="group" aria-label="Chart mood">
      <p className="mode-toggle__title">Mood</p>
      <div className="mode-toggle__switch">
        <button
          type="button"
          className={`mode-toggle__btn ${mode === "simple" ? "is-active" : ""}`}
          onClick={() => onChange("simple")}
          aria-pressed={mode === "simple"}
        >
          Simple
          <small>Guitar chords</small>
        </button>
        <button
          type="button"
          className={`mode-toggle__btn ${mode === "complex" ? "is-active" : ""}`}
          onClick={() => onChange("complex")}
          aria-pressed={mode === "complex"}
        >
          Complex
          <small>Every beat</small>
        </button>
      </div>
      <p className="mode-toggle__hint">
        {mode === "simple"
          ? "Easy guitar chart — chord + how many bars to hold"
          : "Beat detail — |C _ _ _ | style for precise timing"}
      </p>
    </div>
  );
}
