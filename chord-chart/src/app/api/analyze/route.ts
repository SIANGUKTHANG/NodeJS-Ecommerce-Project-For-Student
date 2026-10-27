import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { formatNotation } from "@/lib/format";
import { defaultSections } from "@/lib/sections";
import type { AnalyzeResponse, AnalyzeResult } from "@/lib/types";
import {
  extractVideoId,
  fetchOEmbed,
  toThumbnailUrl,
  toWatchUrl,
} from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 300;

const PYTHON = process.env.PYTHON_BIN || "python3";
const SCRIPT = path.join(process.cwd(), "python", "analyze_chords.py");
const MAX_SECONDS = Number(process.env.CHORD_MAX_SECONDS || 120);

function emptyBars(count = 8): string[][] {
  return Array.from({ length: count }, () => ["_", "_", "_", "_"]);
}

function runPython(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(PYTHON, [SCRIPT, ...args], {
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
        YT_DLP: process.env.YT_DLP || "yt-dlp",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseAnalyzeOutput(stdout: string): AnalyzeResponse {
  const line = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .pop();
  if (!line) {
    return { ok: false, error: "Analyzer returned no output." };
  }
  try {
    return JSON.parse(line) as AnalyzeResponse;
  } catch {
    return { ok: false, error: "Failed to parse analyzer output." };
  }
}

function withSections(result: AnalyzeResult): AnalyzeResult {
  const sections = result.sections?.length
    ? result.sections
    : defaultSections(result.bars.length);
  return {
    ...result,
    sections,
    transposeOffset: result.transposeOffset ?? 0,
    notation: formatNotation(result.bars, 4, sections),
  };
}

function manualChart(meta: {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl?: string;
  notice: string;
}): AnalyzeResult {
  const bars = emptyBars(8);
  return withSections({
    ok: true,
    videoId: meta.videoId,
    title: meta.title,
    artist: meta.artist,
    url: toWatchUrl(meta.videoId),
    duration: null,
    bpm: 100,
    timeSignature: "4/4",
    analyzedSeconds: 0,
    bars,
    notation: formatNotation(bars, 4),
    progression: [],
    barCount: bars.length,
    thumbnailUrl: meta.thumbnailUrl || toThumbnailUrl(meta.videoId),
    source: "youtube-manual",
    editable: true,
    notice: meta.notice,
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "Please upload an audio file." },
          { status: 400 },
        );
      }

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "chordbars-upload-"));
      const ext = path.extname(file.name) || ".wav";
      const tmpFile = path.join(tmpDir, `upload${ext}`);
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(tmpFile, buf);

      try {
        const { stdout, stderr } = await runPython([
          "--file",
          tmpFile,
          "--max-seconds",
          String(MAX_SECONDS),
          "--title",
          file.name.replace(/\.[^.]+$/, ""),
          "--artist",
          "Uploaded audio",
        ]);
        const parsed = parseAnalyzeOutput(stdout);
        if (!parsed.ok) {
          return NextResponse.json(
            {
              ok: false,
              error: parsed.error || stderr || "Analysis failed.",
            },
            { status: 422 },
          );
        }
        return NextResponse.json(
          withSections({
            ...parsed,
            source: "upload",
            editable: true,
          }),
        );
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    const body = (await req.json()) as {
      url?: string;
      demo?: boolean;
      manualOnly?: boolean;
    };

    if (body.demo) {
      const demoPath = path.join(process.cwd(), "tmp", "test_prog.wav");
      const { stdout } = await runPython([
        "--file",
        demoPath,
        "--max-seconds",
        "20",
        "--title",
        "Demo progression (C – G – Am – F)",
        "--artist",
        "ChordBars",
      ]);
      const parsed = parseAnalyzeOutput(stdout);
      if (!parsed.ok) {
        return NextResponse.json(parsed, { status: 422 });
      }
      return NextResponse.json(
        withSections({ ...parsed, source: "demo", editable: true }),
      );
    }

    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "Paste a YouTube URL to analyze." },
        { status: 400 },
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { ok: false, error: "That doesn’t look like a valid YouTube link." },
        { status: 400 },
      );
    }

    const watchUrl = toWatchUrl(videoId);
    const oembed = await fetchOEmbed(watchUrl);
    const title = oembed?.title || "YouTube song";
    const artist = oembed?.author_name || "YouTube";
    const thumbnailUrl = oembed?.thumbnail_url || toThumbnailUrl(videoId);

    if (body.manualOnly) {
      return NextResponse.json(
        manualChart({
          videoId,
          title,
          artist,
          thumbnailUrl,
          notice:
            "Editable chart ready. Play the video and fill chords beat by beat.",
        }),
      );
    }

    const { stdout, stderr } = await runPython([
      "--url",
      watchUrl,
      "--max-seconds",
      String(MAX_SECONDS),
    ]);
    const parsed = parseAnalyzeOutput(stdout);

    if (!parsed.ok) {
      // Graceful fallback: metadata + editable blank chart + embedded player
      return NextResponse.json(
        manualChart({
          videoId,
          title,
          artist,
          thumbnailUrl,
          notice:
            "Automatic YouTube audio download was blocked. Play the video and fill the chord note by ear — or upload an audio file for auto-analysis.",
        }),
      );
    }

    return NextResponse.json({
      ...withSections({
        ...parsed,
        title: parsed.title || title,
        artist: parsed.artist || artist,
        videoId,
        url: watchUrl,
        thumbnailUrl,
        source: "youtube",
        editable: true,
        notice: stderr.includes("WARNING")
          ? "Analyzed from downloaded audio (estimate)."
          : undefined,
      }),
      requestId: randomUUID(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
