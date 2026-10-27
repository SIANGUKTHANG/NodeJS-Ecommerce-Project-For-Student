"use client";

import { useState } from "react";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { ChordChart } from "@/components/ChordChart";
import { PrintActions } from "@/components/PrintActions";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import type { AnalyzeResult } from "@/lib/types";

export default function HomePage() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          and print as PDF.
        </p>
        <AnalyzeForm
          onResult={setResult}
          onError={setError}
          busy={busy}
          setBusy={setBusy}
        />
        {busy ? (
          <p className="status status--busy" role="status">
            Listening for harmony… this can take a minute for YouTube downloads.
          </p>
        ) : null}
        {error ? (
          <p className="status status--error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      {result ? (
        <div className="result-wrap">
          <PrintActions result={result} />
          {result.videoId ? <YouTubeEmbed videoId={result.videoId} /> : null}
          <ChordChart result={result} onChange={setResult} />
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
              We pull the audio when possible, estimate tempo, and map each beat
              to a chord.
            </li>
            <li>
              Read the chart as{" "}
              <code>|C _ _ _ | G _ _ _ |</code> — bar lines and held beats.
            </li>
            <li>Hit Print / Save PDF for a clean practice sheet.</li>
          </ol>
          <p className="how__note">
            Chord detection is automatic estimation from the mix (not an
            official tab). Edit by ear when a voicing feels off.
          </p>
        </section>
      )}

      <footer className="footer print-hide">
        <span>ChordBars</span>
        <span>YouTube chord notes · PDF print</span>
      </footer>
    </main>
  );
}
