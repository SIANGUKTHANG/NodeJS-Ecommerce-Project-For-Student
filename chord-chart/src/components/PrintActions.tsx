"use client";

import type { AnalyzeResult } from "@/lib/types";
import { formatNotation } from "@/lib/format";
import { formatTransposeLabel } from "@/lib/transpose";

type Props = {
  result: AnalyzeResult;
};

export function PrintActions({ result }: Props) {
  function printPdf() {
    window.print();
  }

  function sheetText() {
    const offset = result.transposeOffset ?? 0;
    return [
      result.title,
      result.artist,
      `${Math.round(result.bpm)} BPM · ${result.timeSignature}${
        offset ? ` · transpose ${formatTransposeLabel(offset)}` : ""
      }`,
      result.url || "",
      "",
      formatNotation(result.bars, 4, result.sections),
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

  return (
    <div className="print-actions print-hide">
      <button type="button" className="btn btn--primary" onClick={printPdf}>
        Print / Save PDF
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
