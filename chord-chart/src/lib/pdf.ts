import { jsPDF } from "jspdf";
import { formatNotation, formatSimpleNotation, progressionSummary } from "./format";
import { formatTransposeLabel } from "./transpose";
import type { AnalyzeResult } from "./types";

export type ChartMode = "simple" | "complex";

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "chord-chart"
  );
}

/** Build and download a printable chord PDF. */
export function downloadChordPdf(
  result: AnalyzeResult,
  mode: ChartMode = "complex",
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ChordBars", margin, y);
  y += 22;

  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(result.title, maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 18 + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const offset = result.transposeOffset ?? 0;
  const meta = [
    result.artist,
    `${Math.round(result.bpm)} BPM`,
    result.timeSignature,
    mode === "simple" ? "Simple mode" : "Complex mode",
    offset ? `transpose ${formatTransposeLabel(offset)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.setTextColor(80);
  doc.text(meta, margin, y);
  y += 16;

  if (result.url) {
    const urlLines = doc.splitTextToSize(result.url, maxWidth);
    doc.setTextColor(100);
    doc.text(urlLines, margin, y);
    y += urlLines.length * 12 + 8;
  }

  doc.setTextColor(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Progression", margin, y);
  y += 14;
  doc.setFont("courier", "normal");
  doc.setFontSize(11);
  const prog = doc.splitTextToSize(progressionSummary(result.bars), maxWidth);
  doc.text(prog, margin, y);
  y += prog.length * 14 + 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Chord note", margin, y);
  y += 16;

  const notation =
    mode === "simple"
      ? formatSimpleNotation(result.bars, 4, result.sections)
      : formatNotation(result.bars, 4, result.sections);

  doc.setFont("courier", "normal");
  doc.setFontSize(11);
  for (const line of notation.split("\n")) {
    ensureSpace(16);
    if (line.startsWith("[") && line.endsWith("]")) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(160, 100, 20);
      doc.text(line, margin, y);
      doc.setTextColor(20);
      doc.setFont("courier", "normal");
    } else {
      doc.text(line, margin, y);
    }
    y += 15;
  }

  y += 18;
  ensureSpace(30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "ChordBars · automatic chromagram estimate · not an official tab",
    margin,
    y,
  );

  doc.save(`${slugify(result.title)}-chords.pdf`);
}
