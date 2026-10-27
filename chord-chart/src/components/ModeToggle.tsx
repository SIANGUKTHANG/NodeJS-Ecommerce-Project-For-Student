"use client";

import type { ChartMode } from "@/lib/pdf";

type Props = {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
};

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mode-toggle print-hide" role="group" aria-label="Chart mode">
      <button
        type="button"
        className={`mode-toggle__btn ${mode === "simple" ? "is-active" : ""}`}
        onClick={() => onChange("simple")}
        aria-pressed={mode === "simple"}
      >
        Simple
      </button>
      <button
        type="button"
        className={`mode-toggle__btn ${mode === "complex" ? "is-active" : ""}`}
        onClick={() => onChange("complex")}
        aria-pressed={mode === "complex"}
      >
        Complex
      </button>
      <span className="mode-toggle__hint">
        {mode === "simple"
          ? "One chord per bar"
          : "Beat-by-beat with holds (_ )"}
      </span>
    </div>
  );
}
