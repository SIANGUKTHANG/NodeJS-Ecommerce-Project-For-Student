"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  beatToTime,
  clampBeat,
  timeToBeat,
} from "@/lib/playback";
import type { AnalyzeResult } from "@/lib/types";
import {
  loadYouTubeApi,
  YT_ENDED,
  YT_PAUSED,
  YT_PLAYING,
  type YTPlayer,
} from "@/lib/youtube-api";

type Props = {
  result: AnalyzeResult;
  /** Object URL for uploaded audio (client-side only) */
  localAudioUrl?: string | null;
  seekBeat?: number | null;
  seekToken?: number;
  onPlayhead: (beatIndex: number | null, playing: boolean) => void;
};

export function PlaybackDock({
  result,
  localAudioUrl,
  seekBeat,
  seekToken,
  onPlayhead,
}: Props) {
  const playerHostId = useId().replace(/:/g, "");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"youtube" | "audio" | "none">("none");

  const audioSrc =
    localAudioUrl ||
    (result.source === "demo" ? "/demo.wav" : null);
  const hasYoutube = Boolean(result.videoId);
  const canPlay = hasYoutube || Boolean(audioSrc);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      setReady(false);
      setPlaying(false);
      onPlayhead(null, false);

      if (ytRef.current) {
        try {
          ytRef.current.destroy();
        } catch {
          /* ignore */
        }
        ytRef.current = null;
      }

      if (hasYoutube && result.videoId) {
        setMode("youtube");
        await loadYouTubeApi();
        if (cancelled || !window.YT) return;
        ytRef.current = new window.YT.Player(`yt-player-${playerHostId}`, {
          videoId: result.videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onStateChange: (e) => {
              if (e.data === YT_PLAYING) setPlaying(true);
              if (e.data === YT_PAUSED || e.data === YT_ENDED) {
                setPlaying(false);
                if (e.data === YT_ENDED) onPlayhead(null, false);
              }
            },
          },
        });
        return;
      }

      if (audioSrc) {
        setMode("audio");
        setReady(true);
        return;
      }

      setMode("none");
    }

    void setup();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ytRef.current) {
        try {
          ytRef.current.destroy();
        } catch {
          /* ignore */
        }
        ytRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.videoId, audioSrc, playerHostId]);

  // Playhead polling
  useEffect(() => {
    function tick() {
      let t = 0;
      if (mode === "youtube" && ytRef.current?.getCurrentTime) {
        t = ytRef.current.getCurrentTime() || 0;
      } else if (mode === "audio" && audioRef.current) {
        t = audioRef.current.currentTime || 0;
      }
      const beat = clampBeat(timeToBeat(t, result.bpm), result.barCount);
      onPlayhead(beat, playing);
      rafRef.current = requestAnimationFrame(tick);
    }

    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, mode, result.bpm, result.barCount, onPlayhead]);

  // External seek from chart click
  useEffect(() => {
    if (seekBeat == null || seekToken == null) return;
    const t = beatToTime(seekBeat, result.bpm);
    if (mode === "youtube" && ytRef.current) {
      ytRef.current.seekTo(t, true);
      onPlayhead(seekBeat, playing);
    } else if (mode === "audio" && audioRef.current) {
      audioRef.current.currentTime = t;
      onPlayhead(seekBeat, playing);
    }
  }, [seekBeat, seekToken, mode, result.bpm, onPlayhead, playing]);

  function toggle() {
    if (!canPlay || !ready) return;
    if (mode === "youtube" && ytRef.current) {
      if (playing) ytRef.current.pauseVideo();
      else ytRef.current.playVideo();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  if (!canPlay) return null;

  return (
    <div className="playback-dock print-hide">
      {mode === "youtube" ? (
        <div className="yt-embed">
          <div id={`yt-player-${playerHostId}`} />
        </div>
      ) : null}

      {mode === "audio" && audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            onPlayhead(null, false);
          }}
        />
      ) : null}

      <div className="playback-dock__controls">
        <button
          type="button"
          className="btn btn--primary btn--compact playback-dock__play"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "Pause" : "Play"}
          <span className="playback-dock__note" aria-hidden="true">
            ♪
          </span>
        </button>
        <p className="playback-dock__hint">
          {ready
            ? "♪ follows the active beat while music plays — tap a beat to jump"
            : "Loading player…"}
        </p>
      </div>
    </div>
  );
}
