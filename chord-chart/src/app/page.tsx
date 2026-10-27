"use client";

import { useCallback, useState } from "react";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { ChordChart } from "@/components/ChordChart";
import { ListenExplainer } from "@/components/ListenExplainer";
import { ModeToggle } from "@/components/ModeToggle";
import { PlaybackDock } from "@/components/PlaybackDock";
import { PrintActions } from "@/components/PrintActions";
import { TimingControls } from "@/components/TimingControls";
import type { ChartMode } from "@/lib/pdf";
import type { AnalyzeResult } from "@/lib/types";

export default function HomePage() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekBeat, setSeekBeat] = useState<number | null>(null);
  const [seekToken, setSeekToken] = useState(0);
  const [mode, setMode] = useState<ChartMode>("simple");

  const onPlayhead = useCallback((beat: number | null, playing: boolean) => {
    setPlayheadBeat(beat);
    setIsPlaying(playing);
  }, []);

  function handleResult(next: AnalyzeResult | null) {
    setResult(next);
    setPlayheadBeat(null);
    setIsPlaying(false);
    setSeekBeat(null);
  }

  function seekToBeat(beatIndex: number) {
    setSeekBeat(beatIndex);
    setSeekToken((n) => n + 1);
    setPlayheadBeat(beatIndex);
  }

  return (
    <main className="page">
      <div className="atmosphere" aria-hidden="true" />

      <header className="hero print-hide">
        <div className="hero__brand">
          <span className="hero__mark" aria-hidden="true">
            |●
          </span>
          <h1 className="hero__name">ChordBars</h1>
        </div>
        <p className="hero__tag">
          Paste a YouTube song. Get a beat-by-beat chord note ready to play —
          and export as PDF.
        </p>
        <AnalyzeForm
          onResult={handleResult}
          onLocalAudioUrl={setLocalAudioUrl}
          onError={setError}
          busy={busy}
          setBusy={setBusy}
        />
        {busy ? (
          <p className="status status--busy" role="status">
            Listening for harmony… chromagram matching in progress.
          </p>
        ) : null}
        {error ? (
          <p className="status status--error" role="alert">
            {error}
          </p>
        ) : null}
        <ListenExplainer />
      </header>

      {result ? (
        <div className="result-wrap">
          <ModeToggle mode={mode} onChange={setMode} />
          <PrintActions result={result} mode={mode} />
          <PlaybackDock
            result={result}
            localAudioUrl={localAudioUrl}
            seekBeat={seekBeat}
            seekToken={seekToken}
            onPlayhead={onPlayhead}
          />
          <TimingControls result={result} onChange={setResult} />
          <ChordChart
            result={result}
            mode={mode}
            onChange={setResult}
            playheadBeat={playheadBeat}
            isPlaying={isPlaying}
            onSeekBeat={seekToBeat}
          />
          {result.url ? (
            <p className="source-link print-hide">
              Source:{" "}
              <a href={result.url} target="_blank" rel="noreferrer">
                {result.url}
              </a>
            </p>
          ) : null}
        </div>
      ) : (
        <section className="how print-hide" aria-label="How it works">
          <h2>How it works</h2>
          <ol>
            <li>Paste a YouTube URL (or try the demo / upload audio).</li>
            <li>
              Audio is analyzed with a chromagram + chord templates (not a chat
              LLM).
            </li>
            <li>
              Switch <strong>Simple</strong> (one chord/bar) or{" "}
              <strong>Complex</strong> (|C _ _ _| beats).
            </li>
            <li>
              Hit <strong>Play ♪</strong>, then <strong>Download PDF</strong>{" "}
              for a practice sheet.
            </li>
          </ol>
          <p className="how__note">
            Draft charts only — edit by ear when a voicing feels off.
          </p>
        </section>
      )}

      <footer className="footer print-hide">
        <span>ChordBars</span>
        <span>Chromagram listening · PDF export · Simple/Complex</span>
      </footer>
    </main>
  );
}
