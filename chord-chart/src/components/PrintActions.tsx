"use client";

import type { AnalyzeResult } from "@/lib/types";
import { formatNotation } from "@/lib/format";

type Props = {
  result: AnalyzeResult;
};

export function PrintActions({ result }: Props) {
  function printPdf() {
    window.print();
  }

  function copyNotation() {
    const text = [
      result.title,
      result.artist,
      `${Math.round(result.bpm)} BPM · ${result.timeSignature}`,
      "",
      formatNotation(result.bars, 4),
    ].join("\n");
    void navigator.clipboard.writeText(text);
  }

  function downloadTxt() {
    const text = [
      result.title,
      result.artist,
      `${Math.round(result.bpm)} BPM · ${result.timeSignature}`,
      result.url || "",
      "",
      formatNotation(result.bars, 4),
      "",
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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
