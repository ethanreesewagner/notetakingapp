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
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  getTracksApi,
  addTrackApi,
  deleteTrackApi,
  type SavedTrack,
} from "../lib/apiClient";

type Track = {
  key: string;
  title: string;
  artist: string;
  videoId: string;
  savedId?: string; // present → user-added (deletable)
};

// The built-in default background playlist. These are always present and cannot
// be removed. User-added tracks (from Firebase) are appended after these.
const DEFAULT_PLAYLIST: Track[] = [
  { key: "d0", title: "Resonance", artist: "HOME", videoId: "8GW6sLrK40k" },
  { key: "d1", title: "Crystal Skies", artist: "VXLLAIN, iGRES, ENXK", videoId: "qsD-nh0BJsQ" },
  { key: "d2", title: "Simpsonwave 1995", artist: "FrankJavCee", videoId: "EuVTt-M3IXo" },
  { key: "d3", title: "Liminal Space Music", artist: "Dreamcore / Weirdcore", videoId: "sJnsxAF6Zoo" },
  { key: "d4", title: "Complete Music Mix", artist: "Frutiger Aero", videoId: "J_BwEIjCGHc" },
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
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
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

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BackgroundMusicPlayer() {
  const { user } = useAuth();

  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const playlist: Track[] = [
    ...DEFAULT_PLAYLIST,
    ...savedTracks.map((t) => ({
      key: t.id,
      title: t.title,
      artist: t.artist,
      videoId: t.videoId,
      savedId: t.id,
    })),
  ];

  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(50);

  // Progress state
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrubbingRef = useRef(false);

  // Add-track form state
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest index & playlist length accessible inside YT callbacks.
  const currentRef = useRef(current);
  currentRef.current = current;
  const lenRef = useRef(playlist.length);
  lenRef.current = playlist.length;

  // Load the user's saved tracks once they're authenticated.
  useEffect(() => {
    if (!user?.uid) {
      setSavedTracks([]);
      return;
    }
    getTracksApi()
      .then(setSavedTracks)
      .catch(() => {});
  }, [user?.uid]);

  // Initialize the invisible YouTube player once.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        height: "1",
        width: "1",
        videoId: DEFAULT_PLAYLIST[0].videoId,
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
              const next = (currentRef.current + 1) % lenRef.current;
              currentRef.current = next;
              setCurrent(next);
              playerRef.current?.loadVideoById(playlistRef.current[next].videoId);
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

  // Keep a ref to the current playlist so YT callbacks read fresh videoIds.
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;

  // Poll playback position for the progress bar while playing.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || scrubbingRef.current) return;
      const d = p.getDuration?.() ?? 0;
      const t = p.getCurrentTime?.() ?? 0;
      setDuration(d);
      setElapsed(t);
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const playIndex = (i: number) => {
    if (!playerRef.current) return;
    setCurrent(i);
    currentRef.current = i;
    setElapsed(0);
    setDuration(0);
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

  // Progress bar seeking
  const onSeekInput = (v: number) => {
    scrubbingRef.current = true;
    setElapsed(v);
  };
  const onSeekCommit = (v: number) => {
    playerRef.current?.seekTo(v, true);
    setElapsed(v);
    scrubbingRef.current = false;
  };

  const handleAddTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const saved = await addTrackApi(newUrl.trim(), newTitle.trim() || undefined);
      setSavedTracks((prev) => [...prev, saved]);
      setNewUrl("");
      setNewTitle("");
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add track.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTrack = async (savedId: string) => {
    const removedIdx = playlist.findIndex((t) => t.savedId === savedId);
    try {
      await deleteTrackApi(savedId);
      setSavedTracks((prev) => prev.filter((t) => t.id !== savedId));
      // If we removed the track currently playing (or one before it), fix index.
      if (removedIdx !== -1 && removedIdx <= current && current > 0) {
        setCurrent((c) => c - 1);
      }
    } catch {
      /* ignore delete failures */
    }
  };

  const track = playlist[current] ?? DEFAULT_PLAYLIST[0];
  const seekMax = duration > 0 ? duration : 0;

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

            {/* Seekable progress bar */}
            <div className="music-progress">
              <input
                className="music-seek"
                type="range"
                min={0}
                max={seekMax || 100}
                step={1}
                value={Math.min(elapsed, seekMax || 100)}
                disabled={!ready || seekMax === 0}
                onChange={(e) => onSeekInput(Number(e.target.value))}
                onMouseUp={(e) => onSeekCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => onSeekCommit(Number((e.target as HTMLInputElement).value))}
                aria-label="Seek"
                style={{
                  background: `linear-gradient(to right, var(--accent-color) ${
                    seekMax ? (Math.min(elapsed, seekMax) / seekMax) * 100 : 0
                  }%, rgba(255,255,255,0.15) ${
                    seekMax ? (Math.min(elapsed, seekMax) / seekMax) * 100 : 0
                  }%)`,
                }}
              />
              <div className="music-time">
                <span>{formatTime(elapsed)}</span>
                <span>{formatTime(duration)}</span>
              </div>
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

            <div className="music-vol-row">
              <input
                className="music-volume"
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
              />
            </div>

            <div className="music-tracklist">
              {playlist.map((t, i) => (
                <div
                  key={t.key}
                  className={`music-track ${i === current ? "active" : ""}`}
                >
                  <button
                    className="music-track-main"
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
                  {t.savedId && (
                    <button
                      className="music-track-delete"
                      onClick={() => handleDeleteTrack(t.savedId!)}
                      title="Remove from playlist"
                      aria-label="Remove track"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add-your-own-music */}
            {user &&
              (showAdd ? (
                <form className="music-add-form" onSubmit={handleAddTrack}>
                  <input
                    className="music-add-input"
                    type="text"
                    placeholder="Paste a YouTube link…"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    autoFocus
                  />
                  <input
                    className="music-add-input"
                    type="text"
                    placeholder="Title (optional)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  {addError && <div className="music-add-error">{addError}</div>}
                  <div className="music-add-actions">
                    <button
                      type="button"
                      className="music-add-cancel"
                      onClick={() => {
                        setShowAdd(false);
                        setAddError(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="music-add-save"
                      disabled={adding || !newUrl.trim()}
                    >
                      {adding ? <Loader2 size={13} className="animate-spin" /> : "Add"}
                    </button>
                  </div>
                </form>
              ) : (
                <button className="music-add-btn" onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Add your own music
                </button>
              ))}
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
