"use client";

export function ListenExplainer() {
  return (
    <details className="listen-explainer print-hide">
      <summary>How does ChordBars “listen”? What AI?</summary>
      <div className="listen-explainer__body">
        <p>
          It is <strong>not</strong> ChatGPT / a chat LLM guessing chords from
          the title. ChordBars runs a small{" "}
          <strong>audio signal pipeline</strong> on the song mix:
        </p>
        <ol>
          <li>Get audio (YouTube download when allowed, or your upload / demo)</li>
          <li>Build a <strong>chromagram</strong> (how strong each pitch class is over time)</li>
          <li>Match frames to major/minor chord templates</li>
          <li>Estimate tempo and snap chords onto 4/4 beats</li>
        </ol>
        <p>
          So the “AI” here is classical music-information-retrieval (template
          matching + tempo tracking) in Python — useful for a draft chart, not a
          trained generative model. Always tweak by ear.
        </p>
      </div>
    </details>
  );
}
