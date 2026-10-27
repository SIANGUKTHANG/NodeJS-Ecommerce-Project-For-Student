"use client";

export function ListenExplainer() {
  return (
    <details className="listen-explainer print-hide">
      <summary>How does ChordBars “listen”? What AI?</summary>
      <div className="listen-explainer__body">
        <p>
          It is <strong>not</strong> ChatGPT. ChordBars runs an{" "}
          <strong>audio chromagram</strong> pipeline that compares each frame’s
          pitches to major vs minor templates (root + 3rd + 5th), then snaps to
          bars for guitar-friendly charts.
        </p>
        <ol>
          <li>Get audio (YouTube when allowed, or upload / demo)</li>
          <li>Build a chromagram and decide major vs minor from the 3rd</li>
          <li>Stabilize to one chord per bar (less flicker)</li>
          <li>
            <strong>Simple mood</strong> = guitar blocks ·{" "}
            <strong>Complex mood</strong> = beat holds
          </li>
        </ol>
        <p>Always tweak by ear — it’s a draft helper, not an official tab.</p>
      </div>
    </details>
  );
}
