"use client";

import { useState } from "react";
import type { AnalyzeResult } from "@/lib/types";
import {
  formatNotation,
  formatSimpleNotation,
} from "@/lib/format";
import { downloadChordPdf, type ChartMode } from "@/lib/pdf";
import { formatTransposeLabel } from "@/lib/transpose";

type Props = {
  result: AnalyzeResult;
  mode: ChartMode;
};

export function PrintActions({ result, mode }: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);

  function sheetText() {
    const offset = result.transposeOffset ?? 0;
    const body =
      mode === "simple"
        ? formatSimpleNotation(result.bars, 4, result.sections)
        : formatNotation(result.bars, 4, result.sections);
    return [
      result.title,
      result.artist,
      `${Math.round(result.bpm)} BPM · ${result.timeSignature}${
        offset ? ` · transpose ${formatTransposeLabel(offset)}` : ""
      } · ${mode} mode`,
      result.url || "",
      "",
      body,
      "",
    ]
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .join("\n");
  }

  function copyNotation() {
    void navigator.clipboard.writeText(sheetText());
  }

  function downloadTxt() {
    const blob = new Blob([sheetText()], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${slugify(result.title)}-chords.txt`;
    a.click();
    URL.revokeObjectURL(href);
  }

  function exportPdf() {
    setPdfBusy(true);
    try {
      downloadChordPdf(result, mode);
    } finally {
      setTimeout(() => setPdfBusy(false), 400);
    }
  }

  return (
    <div className="print-actions print-hide">
      <button
        type="button"
        className="btn btn--primary"
        onClick={exportPdf}
        disabled={pdfBusy}
      >
        {pdfBusy ? "Building PDF…" : "Download PDF"}
      </button>
      <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
        Print
      </button>
      <button type="button" className="btn btn--ghost" onClick={copyNotation}>
        Copy notation
      </button>
      <button type="button" className="btn btn--ghost" onClick={downloadTxt}>
        Download .txt
      </button>
    </div>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "chord-chart"
  );
}
