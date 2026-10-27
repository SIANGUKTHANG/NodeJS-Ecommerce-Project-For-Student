"use client";

import { FormEvent, useRef, useState } from "react";
import type { AnalyzeResponse, AnalyzeResult } from "@/lib/types";

type Props = {
  onResult: (result: AnalyzeResult | null) => void;
  onLocalAudioUrl: (url: string | null) => void;
  onError: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

export function AnalyzeForm({
  onResult,
  onLocalAudioUrl,
  onError,
  busy,
  setBusy,
}: Props) {
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  function clearLocalAudio() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    onLocalAudioUrl(null);
  }

  async function analyzeUrl(event: FormEvent) {
    event.preventDefault();
    onError(null);
    onResult(null);
    clearLocalAudio();
    setBusy(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!data.ok) {
        onError(data.error);
        return;
      }
      onResult(data);
    } catch {
      onError("Network error while analyzing. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeDemo() {
    onError(null);
    onResult(null);
    clearLocalAudio();
    setBusy(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!data.ok) {
        onError(data.error);
        return;
      }
      onResult(data);
    } catch {
      onError("Could not run the demo analysis.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeFile(file: File) {
    onError(null);
    onResult(null);
    clearLocalAudio();
    setBusy(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      onLocalAudioUrl(objectUrl);

      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = (await res.json()) as AnalyzeResponse;
      if (!data.ok) {
        clearLocalAudio();
        onError(data.error);
        return;
      }
      onResult(data);
    } catch {
      clearLocalAudio();
      onError("Upload analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="analyze-form">
      <form onSubmit={analyzeUrl} className="analyze-form__row">
        <label className="sr-only" htmlFor="yt-url">
          YouTube URL
        </label>
        <input
          id="yt-url"
          className="analyze-form__input"
          type="url"
          inputMode="url"
          placeholder="Paste a YouTube song URL…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={busy}
        />
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? "Analyzing…" : "Analyze chords"}
        </button>
      </form>

      <div className="analyze-form__alt">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={analyzeDemo}
          disabled={busy}
        >
          Try demo song
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Upload audio
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void analyzeFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
