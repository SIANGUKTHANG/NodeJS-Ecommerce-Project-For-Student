#!/usr/bin/env python3
"""
Chromagram-based chord estimator for YouTube / audio files.
Outputs JSON bars + tempo/offset so the UI can stay in sync with the song.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import median_filter, uniform_filter1d

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Emphasize root / third / fifth so major vs minor (M3 vs m3) separates cleanly.
MAJ_PROFILE = np.array([1.0, 0.04, 0.12, 0.04, 1.05, 0.12, 0.06, 0.95, 0.04, 0.18, 0.04, 0.08])
MIN_PROFILE = np.array([1.0, 0.04, 0.12, 1.05, 0.04, 0.12, 0.06, 0.95, 0.04, 0.08, 0.18, 0.04])


def build_templates() -> tuple[list[str], np.ndarray]:
    names: list[str] = []
    mats: list[np.ndarray] = []
    for i, root in enumerate(NOTE_NAMES):
        names.append(root)
        mats.append(np.roll(MAJ_PROFILE, i))
        names.append(f"{root}m")
        mats.append(np.roll(MIN_PROFILE, i))
    templates = np.stack(mats, axis=0)
    templates = templates / (np.linalg.norm(templates, axis=1, keepdims=True) + 1e-9)
    return names, templates


CHORD_NAMES, CHORD_TEMPLATES = build_templates()


def extract_video_id(url: str) -> str | None:
    import re

    patterns = [
        r"(?:v=|/embed/|/shorts/|youtu\.be/)([A-Za-z0-9_-]{11})",
        r"^([A-Za-z0-9_-]{11})$",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def download_audio(url: str, out_wav: Path, max_seconds: int = 600) -> dict:
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Could not parse a YouTube video id from the URL.")

    ytdlp = os.environ.get("YT_DLP", "yt-dlp")
    common = [
        ytdlp,
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--js-runtimes",
        "node",
        "-x",
        "--audio-format",
        "wav",
        "--audio-quality",
        "0",
        "-o",
        str(out_wav.with_suffix(".%(ext)s")),
    ]
    attempts = [
        common
        + [
            "--download-sections",
            f"*0-{max_seconds}",
            "--force-keyframes-at-cuts",
            "--extractor-args",
            "youtube:player_client=android,web",
            f"https://www.youtube.com/watch?v={video_id}",
        ],
        common
        + [
            "--extractor-args",
            "youtube:player_client=ios,web",
            f"https://www.youtube.com/watch?v={video_id}",
        ],
        common + [f"https://www.youtube.com/watch?v={video_id}"],
    ]
    last_err = "Unknown yt-dlp error."
    for cmd in attempts:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0 and out_wav.exists():
            break
        last_err = result.stderr.strip() or result.stdout.strip() or last_err
    else:
        raise RuntimeError(
            "YouTube blocked automatic audio download in this environment "
            "(bot check). Use Upload audio, or open the editable chart with the "
            "embedded player. Details: "
            + last_err[:240]
        )

    meta_cmd = [
        ytdlp,
        "--no-playlist",
        "--skip-download",
        "--print",
        "%(title)s\n%(uploader)s\n%(duration)s",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    meta = subprocess.run(meta_cmd, capture_output=True, text=True)
    title, artist, duration = "Unknown title", "Unknown artist", None
    if meta.returncode == 0:
        lines = [ln.strip() for ln in meta.stdout.splitlines() if ln.strip()]
        if len(lines) >= 1:
            title = lines[0]
        if len(lines) >= 2:
            artist = lines[1]
        if len(lines) >= 3 and lines[2].replace(".", "", 1).isdigit():
            duration = int(float(lines[2]))

    return {
        "videoId": video_id,
        "title": title,
        "artist": artist,
        "duration": duration,
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


def ensure_wav(path: Path, workdir: Path) -> Path:
    """Convert non-wav audio to wav via ffmpeg when needed."""
    if path.suffix.lower() in {".wav", ".flac", ".ogg"}:
        return path
    out = workdir / "converted.wav"
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-ac",
        "1",
        "-ar",
        "22050",
        str(out),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not out.exists():
        raise RuntimeError(
            "Could not decode audio. Use WAV/FLAC/OGG, or ensure ffmpeg is installed."
        )
    return out


def load_mono(path: Path, target_sr: int = 22050, max_seconds: int = 600) -> tuple[np.ndarray, int]:
    audio, sr = sf.read(str(path), always_2d=True)
    mono = audio.mean(axis=1).astype(np.float64)
    if sr != target_sr:
        g = math.gcd(sr, target_sr)
        up, down = target_sr // g, sr // g
        mono = signal.resample_poly(mono, up, down)
        sr = target_sr
    if max_seconds > 0:
        max_len = int(max_seconds * sr)
        if len(mono) > max_len:
            mono = mono[:max_len]
    peak = np.max(np.abs(mono)) + 1e-9
    mono = mono / peak
    return mono, sr


def stft_magnitude(y: np.ndarray, n_fft: int = 4096, hop: int = 2048) -> np.ndarray:
    _, _, zxx = signal.stft(
        y,
        nperseg=n_fft,
        noverlap=n_fft - hop,
        window="hann",
        boundary=None,
        padded=False,
    )
    return np.abs(zxx)


def hz_to_midi(hz: np.ndarray) -> np.ndarray:
    return 69.0 + 12.0 * np.log2(np.maximum(hz, 1e-9) / 440.0)


def chromagram(mag: np.ndarray, sr: int, n_fft: int) -> np.ndarray:
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / sr)
    midi = hz_to_midi(freqs)
    chroma_idx = np.mod(np.round(midi).astype(int), 12)
    valid = (freqs >= 80) & (freqs <= 4000)
    weights = np.ones_like(freqs)
    weights[(freqs >= 200) & (freqs <= 1200)] *= 1.7
    # De-emphasize very low bass that confuses root vs fifth
    weights[freqs < 120] *= 0.55
    weighted = mag * weights[:, None]
    chroma = np.zeros((12, mag.shape[1]), dtype=np.float64)
    for i in range(12):
        mask = valid & (chroma_idx == i)
        if np.any(mask):
            chroma[i] = weighted[mask].sum(axis=0)
    chroma = np.log1p(chroma * 24.0)
    norms = np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-9
    return chroma / norms


def onset_envelope(y: np.ndarray, sr: int, hop: int = 512, n_fft: int = 1024) -> tuple[np.ndarray, np.ndarray]:
    mag = stft_magnitude(y, n_fft=n_fft, hop=hop)
    flux = np.maximum(np.diff(mag, axis=1, prepend=mag[:, :1]), 0).sum(axis=0)
    flux = flux - np.mean(flux)
    flux = flux / (np.std(flux) + 1e-9)
    kernel = np.hanning(7)
    kernel /= kernel.sum()
    flux = np.convolve(flux, kernel, mode="same")
    times = np.arange(len(flux)) * hop / sr
    return flux, times


def score_tempo(corr: np.ndarray, sr: int, hop: int, bpm: float) -> float:
    lag = 60.0 * sr / (hop * bpm)
    if lag < 1 or lag >= len(corr) - 1:
        return -1.0
    i = int(lag)
    frac = lag - i
    score = (1 - frac) * corr[i] + frac * corr[i + 1]
    # Soft preference for common song tempos
    score *= 1.0 - abs(bpm - 112) / 500.0
    return float(score)


def estimate_tempo(y: np.ndarray, sr: int) -> float:
    hop = 512
    flux, _ = onset_envelope(y, sr, hop=hop)
    if len(flux) < 16:
        return 100.0
    corr = np.correlate(flux, flux, mode="full")[len(flux) - 1 :]
    best_bpm, best_score = 100.0, -1.0
    for bpm in np.arange(70, 181, 0.5):
        score = score_tempo(corr, sr, hop, float(bpm))
        if score > best_score:
            best_score = score
            best_bpm = float(bpm)

    # Prefer the tempo whose half/double also fits well (avoid wrong octave)
    candidates = [best_bpm]
    if best_bpm * 2 <= 180:
        candidates.append(best_bpm * 2)
    if best_bpm / 2 >= 70:
        candidates.append(best_bpm / 2)
    ranked = sorted(
        ((bpm, score_tempo(corr, sr, hop, bpm)) for bpm in candidates),
        key=lambda x: x[1],
        reverse=True,
    )
    return float(np.clip(ranked[0][0], 60, 180))


def estimate_beat_offset(y: np.ndarray, sr: int, bpm: float) -> float:
    """Find phase (seconds) so a metronome at `bpm` lands on onsets."""
    hop = 512
    flux, times = onset_envelope(y, sr, hop=hop)
    if len(flux) < 8:
        return 0.0
    beat_dur = 60.0 / bpm
    # Only score early song (downbeat usually clear in first ~20s)
    window = min(float(times[-1]), 24.0)
    best_off, best_score = 0.0, -1e18
    for off in np.linspace(0.0, beat_dur, 48, endpoint=False):
        score = 0.0
        t = off
        while t <= window:
            idx = int(round(t * sr / hop))
            if 0 <= idx < len(flux):
                score += float(flux[idx])
            t += beat_dur
        if score > best_score:
            best_score = score
            best_off = float(off)
    return best_off


def decide_quality(chroma_vec: np.ndarray, root: int) -> str:
    major_third = float(chroma_vec[(root + 4) % 12])
    minor_third = float(chroma_vec[(root + 3) % 12])
    fifth = float(chroma_vec[(root + 7) % 12])
    # Require a meaningful triad presence before trusting quality
    if major_third + minor_third < 0.08:
        return "maj"
    if minor_third > major_third * 1.12:
        return "min"
    if major_third > minor_third * 1.12:
        return "maj"
    # Near tie: lean on fifth + template residual
    return "min" if minor_third + 0.15 * fifth > major_third else "maj"


def classify_frame(chroma_vec: np.ndarray) -> tuple[str, float]:
    scores = CHORD_TEMPLATES @ chroma_vec
    best_root = 0
    best_pair = -1.0
    for root in range(12):
        pair = max(float(scores[root * 2]), float(scores[root * 2 + 1]))
        # Boost roots that also have a strong fifth
        pair += 0.12 * float(chroma_vec[(root + 7) % 12])
        if pair > best_pair:
            best_pair = pair
            best_root = root

    quality = decide_quality(chroma_vec, best_root)
    name = NOTE_NAMES[best_root] if quality == "maj" else f"{NOTE_NAMES[best_root]}m"
    root_scores = [
        max(float(scores[r * 2]), float(scores[r * 2 + 1])) + 0.12 * float(chroma_vec[(r + 7) % 12])
        for r in range(12)
    ]
    root_scores.sort(reverse=True)
    separation = root_scores[0] - (root_scores[1] if len(root_scores) > 1 else 0.0)
    conf = float(root_scores[0] * 0.6 + separation * 0.4)
    return name, conf


def frames_to_chords(chroma: np.ndarray) -> list[str]:
    smoothed = median_filter(chroma, size=(1, 11))
    # Also smooth gently over time for stability
    smoothed = uniform_filter1d(smoothed, size=5, axis=1, mode="nearest")
    chords: list[str] = []
    for t in range(smoothed.shape[1]):
        name, conf = classify_frame(smoothed[:, t])
        chords.append(name if conf > 0.38 else "_")

    smoothed_labels = chords[:]
    win = 6
    for i in range(len(chords)):
        chunk = chords[max(0, i - win) : i + win + 1]
        votes = [c for c in chunk if c != "_"]
        if votes:
            smoothed_labels[i] = max(set(votes), key=votes.count)
    return smoothed_labels


def quantize_to_beats(
    chords: list[str],
    frame_times: np.ndarray,
    bpm: float,
    beat_offset: float = 0.0,
    audio_duration: float | None = None,
) -> list[str]:
    if len(chords) == 0:
        return []
    beat_dur = 60.0 / bpm
    total_time = (
        float(audio_duration)
        if audio_duration is not None
        else float(frame_times[-1]) if len(frame_times) else 0.0
    )
    # Cover the full analyzed audio — no short artificial beat cap
    if total_time <= beat_offset:
        return ["_"] * 4
    n_beats = int(math.ceil((total_time - beat_offset) / beat_dur))
    n_beats = max(4, n_beats)
    # Hard safety for memory (~20 min at 60 BPM)
    n_beats = min(n_beats, 4800)

    beat_chords: list[str] = []
    for b in range(n_beats):
        t0 = beat_offset + b * beat_dur
        t1 = t0 + beat_dur
        if t0 >= total_time:
            break
        mask = (frame_times >= t0) & (frame_times < min(t1, total_time))
        if not np.any(mask):
            idx = int(np.argmin(np.abs(frame_times - (t0 + min(t1, total_time)) / 2)))
            beat_chords.append(chords[idx])
            continue
        subset = [chords[i] for i, m in enumerate(mask) if m]
        subset = [c for c in subset if c != "_"] or ["_"]
        beat_chords.append(max(set(subset), key=subset.count))
    return beat_chords


def stabilize_bar_chords(beat_chords: list[str], beats_per_bar: int = 4) -> list[str]:
    bar_chords: list[str] = []
    for i in range(0, len(beat_chords), beats_per_bar):
        chunk = beat_chords[i : i + beats_per_bar]
        votes = [c for c in chunk if c != "_"]
        if not votes:
            bar_chords.append(bar_chords[-1] if bar_chords else "_")
        else:
            bar_chords.append(max(set(votes), key=votes.count))
    cleaned = bar_chords[:]
    for i in range(1, len(cleaned) - 1):
        if cleaned[i - 1] == cleaned[i + 1] and cleaned[i] != cleaned[i - 1]:
            cleaned[i] = cleaned[i - 1]
    # Drop trailing unknown bars
    while len(cleaned) > 1 and cleaned[-1] == "_":
        cleaned.pop()
    expanded: list[str] = []
    for c in cleaned:
        expanded.extend([c] * beats_per_bar)
    return expanded


def beats_to_bars(beat_chords: list[str], beats_per_bar: int = 4) -> list[list[str]]:
    bars: list[list[str]] = []
    prev = "_"
    for i in range(0, len(beat_chords), beats_per_bar):
        chunk = beat_chords[i : i + beats_per_bar]
        votes = [c for c in chunk if c != "_"]
        chord = max(set(votes), key=votes.count) if votes else prev
        if chord == "_":
            bars.append(["_"] * beats_per_bar)
        else:
            bar = [chord] + ["_"] * (beats_per_bar - 1)
            bars.append(bar)
            prev = chord
    while len(bars) > 1 and all(x == "_" for x in bars[-1]):
        bars.pop()
    return bars


def format_bars(bars: list[list[str]]) -> str:
    parts = []
    for bar in bars:
        parts.append("|" + " ".join(bar) + " ")
    return "".join(parts).rstrip() + "|"


def analyze_wav(path: Path, max_seconds: int = 600) -> dict:
    y, sr = load_mono(path, max_seconds=max_seconds)
    duration = len(y) / sr
    hop = 2048
    n_fft = 4096
    mag = stft_magnitude(y, n_fft=n_fft, hop=hop)
    chroma = chromagram(mag, sr, n_fft)
    frame_times = np.arange(chroma.shape[1]) * hop / sr
    bpm = estimate_tempo(y, sr)
    beat_offset = estimate_beat_offset(y, sr, bpm)
    raw = frames_to_chords(chroma)
    beat_chords = quantize_to_beats(
        raw,
        frame_times,
        bpm,
        beat_offset=beat_offset,
        audio_duration=duration,
    )
    beat_chords = stabilize_bar_chords(beat_chords)
    bars = beats_to_bars(beat_chords)
    notation = format_bars(bars)
    progression = [next((c for c in bar if c != "_"), "_") for bar in bars]
    return {
        "bpm": round(bpm, 1),
        "beatOffset": round(beat_offset, 3),
        "beatsPerBar": 4,
        "timeSignature": "4/4",
        "analyzedSeconds": round(duration, 1),
        "durationSeconds": round(duration, 1),
        "bars": bars,
        "notation": notation,
        "progression": progression,
        "barCount": len(bars),
        "complete": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="YouTube URL")
    parser.add_argument("--file", help="Local audio file (wav/flac/ogg)")
    parser.add_argument("--max-seconds", type=int, default=600)
    parser.add_argument("--title", default=None)
    parser.add_argument("--artist", default=None)
    args = parser.parse_args()

    if not args.url and not args.file:
        print(json.dumps({"error": "Provide --url or --file"}))
        return 1

    try:
        with tempfile.TemporaryDirectory(prefix="chordbars-") as tmp:
            tmp_path = Path(tmp)
            meta = {
                "videoId": None,
                "title": args.title or "Untitled",
                "artist": args.artist or "Unknown",
                "duration": None,
                "url": args.url,
            }
            if args.url:
                wav = tmp_path / "audio.wav"
                meta = download_audio(args.url, wav, max_seconds=args.max_seconds)
                audio_path = wav
            else:
                audio_path = Path(args.file)
                if not audio_path.exists():
                    raise FileNotFoundError(f"Audio file not found: {audio_path}")
                audio_path = ensure_wav(audio_path, tmp_path)

            analysis = analyze_wav(audio_path, max_seconds=args.max_seconds)
            # If metadata duration exists and we truncated, mark incomplete
            if meta.get("duration") and analysis["analyzedSeconds"] + 1 < meta["duration"]:
                analysis["complete"] = False
            out = {**meta, **analysis, "ok": True}
            print(json.dumps(out))
            return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
