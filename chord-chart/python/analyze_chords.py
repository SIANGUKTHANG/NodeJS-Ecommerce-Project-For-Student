#!/usr/bin/env python3
"""
Chromagram-based chord estimator for YouTube / audio files.
Outputs JSON: bars of 4 beats in |C _ _ _ | G _ _ _ | style.
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
from scipy.ndimage import median_filter

NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJ_PROFILE = np.array([1.0, 0.0, 0.5, 0.0, 0.8, 0.3, 0.0, 0.9, 0.0, 0.4, 0.0, 0.2])
MIN_PROFILE = np.array([1.0, 0.0, 0.5, 0.8, 0.0, 0.3, 0.0, 0.9, 0.0, 0.0, 0.4, 0.2])


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


def download_audio(url: str, out_wav: Path, max_seconds: int = 180) -> dict:
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
        if len(lines) >= 3 and lines[2].isdigit():
            duration = int(lines[2])

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


def load_mono(path: Path, target_sr: int = 22050, max_seconds: int = 180) -> tuple[np.ndarray, int]:
    audio, sr = sf.read(str(path), always_2d=True)
    mono = audio.mean(axis=1).astype(np.float64)
    if sr != target_sr:
        g = math.gcd(sr, target_sr)
        up, down = target_sr // g, sr // g
        mono = signal.resample_poly(mono, up, down)
        sr = target_sr
    max_len = int(max_seconds * sr)
    if len(mono) > max_len:
        mono = mono[:max_len]
    peak = np.max(np.abs(mono)) + 1e-9
    mono = mono / peak
    return mono, sr


def stft_magnitude(y: np.ndarray, n_fft: int = 4096, hop: int = 2048) -> np.ndarray:
    # scipy.signal.stft returns Zxx complex
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
    # Ignore below ~60Hz and above ~5kHz
    valid = (freqs >= 60) & (freqs <= 5000)
    chroma = np.zeros((12, mag.shape[1]), dtype=np.float64)
    for i in range(12):
        mask = valid & (chroma_idx == i)
        if np.any(mask):
            chroma[i] = mag[mask].sum(axis=0)
    # Normalize frames
    norms = np.linalg.norm(chroma, axis=0, keepdims=True) + 1e-9
    return chroma / norms


def estimate_tempo(y: np.ndarray, sr: int) -> float:
    # Onset strength via spectral flux + tempo autocorrelation
    hop = 512
    n_fft = 1024
    mag = stft_magnitude(y, n_fft=n_fft, hop=hop)
    flux = np.maximum(np.diff(mag, axis=1), 0).sum(axis=0)
    if len(flux) < 16:
        return 100.0
    flux = flux - np.mean(flux)
    flux = flux / (np.std(flux) + 1e-9)
    # Smooth lightly
    kernel = np.hanning(5)
    kernel /= kernel.sum()
    flux = np.convolve(flux, kernel, mode="same")

    corr = np.correlate(flux, flux, mode="full")[len(flux) - 1 :]
    # Score candidate BPMs in pop/rock range
    best_bpm, best_score = 100.0, -1.0
    for bpm in np.arange(70, 161, 0.5):
        lag = 60.0 * sr / (hop * bpm)
        if lag < 1 or lag >= len(corr) - 1:
            continue
        i = int(lag)
        frac = lag - i
        # linear interpolate correlation at fractional lag
        score = (1 - frac) * corr[i] + frac * corr[i + 1]
        # Prefer mid-range tempos slightly
        score *= 1.0 - abs(bpm - 110) / 400.0
        if score > best_score:
            best_score = float(score)
            best_bpm = float(bpm)
    return float(np.clip(best_bpm, 60, 180))


def frames_to_chords(chroma: np.ndarray) -> list[str]:
    # Smooth chroma over time
    smoothed = median_filter(chroma, size=(1, 5))
    scores = CHORD_TEMPLATES @ smoothed  # (24, T)
    idx = np.argmax(scores, axis=0)
    conf = scores.max(axis=0)
    # Low-confidence → rest / continue
    chords = [CHORD_NAMES[i] if c > 0.55 else "_" for i, c in zip(idx, conf)]
    # Median-like smoothing of labels
    smoothed_labels: list[str] = chords[:]
    win = 3
    for i in range(len(chords)):
        chunk = chords[max(0, i - win) : i + win + 1]
        # majority vote ignoring _
        votes = [c for c in chunk if c != "_"]
        if votes:
            smoothed_labels[i] = max(set(votes), key=votes.count)
    return smoothed_labels


def quantize_to_beats(chords: list[str], frame_times: np.ndarray, bpm: float) -> list[str]:
    if len(chords) == 0:
        return []
    beat_dur = 60.0 / bpm
    total_time = float(frame_times[-1]) if len(frame_times) else 0.0
    n_beats = max(4, int(math.floor(total_time / beat_dur)))
    # Cap chart length for readability (~64 bars = 256 beats)
    n_beats = min(n_beats, 256)
    beat_chords: list[str] = []
    for b in range(n_beats):
        t0 = b * beat_dur
        t1 = (b + 1) * beat_dur
        mask = (frame_times >= t0) & (frame_times < t1)
        if not np.any(mask):
            # nearest frame
            idx = int(np.argmin(np.abs(frame_times - (t0 + t1) / 2)))
            beat_chords.append(chords[idx])
            continue
        subset = [chords[i] for i, m in enumerate(mask) if m]
        subset = [c for c in subset if c != "_"] or ["_"]
        beat_chords.append(max(set(subset), key=subset.count))
    return beat_chords


def beats_to_bars(beat_chords: list[str], beats_per_bar: int = 4) -> list[list[str]]:
    bars: list[list[str]] = []
    # Carry previous chord into "_" slots for display convention:
    # first beat shows chord, subsequent same-chord beats become "_"
    display: list[str] = []
    prev = None
    for c in beat_chords:
        if c == "_" or c == prev:
            display.append("_")
        else:
            display.append(c)
            prev = c
    for i in range(0, len(display), beats_per_bar):
        chunk = display[i : i + beats_per_bar]
        while len(chunk) < beats_per_bar:
            chunk.append("_")
        bars.append(chunk)
    return bars


def format_bars(bars: list[list[str]]) -> str:
    parts = []
    for bar in bars:
        parts.append("|" + " ".join(bar) + " ")
    return "".join(parts).rstrip() + "|"


def analyze_wav(path: Path, max_seconds: int = 180) -> dict:
    y, sr = load_mono(path, max_seconds=max_seconds)
    hop = 2048
    n_fft = 4096
    mag = stft_magnitude(y, n_fft=n_fft, hop=hop)
    chroma = chromagram(mag, sr, n_fft)
    frame_times = np.arange(chroma.shape[1]) * hop / sr
    bpm = estimate_tempo(y, sr)
    raw = frames_to_chords(chroma)
    beat_chords = quantize_to_beats(raw, frame_times, bpm)
    bars = beats_to_bars(beat_chords)
    notation = format_bars(bars)
    # Unique progression summary
    progression = []
    for bar in bars:
        head = next((c for c in bar if c != "_"), "_")
        progression.append(head)
    return {
        "bpm": round(bpm, 1),
        "timeSignature": "4/4",
        "analyzedSeconds": round(len(y) / sr, 1),
        "bars": bars,
        "notation": notation,
        "progression": progression,
        "barCount": len(bars),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", help="YouTube URL")
    parser.add_argument("--file", help="Local audio file (wav/flac/ogg)")
    parser.add_argument("--max-seconds", type=int, default=120)
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
            out = {**meta, **analysis, "ok": True}
            print(json.dumps(out))
            return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
