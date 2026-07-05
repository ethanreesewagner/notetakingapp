"use client";

import { useEffect, useRef, useState } from "react";
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  X,
  ListMusic,
} from "lucide-react";

type Track = { title: string; artist: string; videoId: string };

// The default background playlist. These are plain YouTube video IDs that get
// loaded into a tiny, effectively invisible IFrame player.
const DEFAULT_PLAYLIST: Track[] = [
  { title: "Resonance", artist: "HOME", videoId: "8GW6sLrK40k" },
  { title: "Crystal Skies", artist: "VXLLAIN, iGRES, ENXK", videoId: "qsD-nh0BJsQ" },
  { title: "Simpsonwave 1995", artist: "FrankJavCee", videoId: "EuVTt-M3IXo" },
  {
    title: "Liminal Space Music",
    artist: "Dreamcore / Weirdcore",
    videoId: "sJnsxAF6Zoo",
  },
  {
    title: "Complete Music Mix",
    artist: "Frutiger Aero",
    videoId: "J_BwEIjCGHc",
  },
];

// ── YouTube IFrame API loader (shared, loads the script only once) ──────────
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; ENDED: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (v: number) => void;
  destroy: () => void;
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

export default function BackgroundMusicPlayer() {
  const playlist = DEFAULT_PLAYLIST;

  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(50);

  const playerRef = useRef<YTPlayer | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest index accessible inside YT event callbacks.
  const currentRef = useRef(current);
  currentRef.current = current;

  // Initialize the invisible YouTube player once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        height: "1",
        width: "1",
        videoId: playlist[0].videoId,
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: () => {
            playerRef.current?.setVolume(volume);
            if (!cancelled) setReady(true);
          },
          onStateChange: (e: { data: number }) => {
            const YT = window.YT!;
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            else if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
            else if (e.data === YT.PlayerState.ENDED) {
              // Auto-advance to the next track when one finishes.
              const next = (currentRef.current + 1) % playlist.length;
              setCurrent(next);
              playerRef.current?.loadVideoById(playlist[next].videoId);
              playerRef.current?.playVideo();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playIndex = (i: number) => {
    if (!playerRef.current) return;
    setCurrent(i);
    playerRef.current.loadVideoById(playlist[i].videoId);
    playerRef.current.playVideo();
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const next = () => playIndex((current + 1) % playlist.length);
  const prev = () => playIndex((current - 1 + playlist.length) % playlist.length);

  const changeVolume = (v: number) => {
    setVolume(v);
    playerRef.current?.setVolume(v);
  };

  const track = playlist[current];

  return (
    <>
      {/* Invisible player host — offscreen and non-interactive. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div ref={mountRef} />
      </div>

      <div className="music-player">
        {open && (
          <div className="music-panel">
            <div className="music-panel-header">
              <span className="music-panel-title">
                <ListMusic size={13} /> Background Music
              </span>
              <button
                className="music-panel-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="music-now-playing">
              <div className="music-now-title">{track.title}</div>
              <div className="music-now-artist">{track.artist}</div>
            </div>

            <div className="music-controls">
              <button onClick={prev} disabled={!ready} aria-label="Previous">
                <SkipBack size={16} />
              </button>
              <button
                className="music-play-btn"
                onClick={togglePlay}
                disabled={!ready}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={next} disabled={!ready} aria-label="Next">
                <SkipForward size={16} />
              </button>
            </div>

            <input
              className="music-volume"
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
            />

            <div className="music-tracklist">
              {playlist.map((t, i) => (
                <button
                  key={t.videoId}
                  className={`music-track ${i === current ? "active" : ""}`}
                  onClick={() => playIndex(i)}
                  disabled={!ready}
                >
                  <span className="music-track-index">
                    {i === current && playing ? (
                      <span className="music-bars">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="music-track-meta">
                    <span className="music-track-title">{t.title}</span>
                    <span className="music-track-artist">{t.artist}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className={`music-toggle-btn ${playing ? "playing" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title="Background music"
        >
          <Music size={16} />
          <span>{playing ? "Now Playing" : "Background Music"}</span>
        </button>
      </div>
    </>
  );
}
