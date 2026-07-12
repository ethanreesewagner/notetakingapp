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
  Loader2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  getTracksApi,
  addTrackApi,
  updateTrackApi,
  deleteTrackApi,
} from "../lib/apiClient";
import { loadYouTubeApi, formatTime, type YTPlayer } from "../lib/youtube";
import { useMediaPlaylist } from "../lib/useMediaPlaylist";
import DraggablePlaylist from "./DraggablePlaylist";

type Track = {
  key: string;
  title: string;
  artist: string;
  videoId: string;
  savedId?: string;
};

// Built-in defaults — always present, not editable/removable/reorderable.
const DEFAULT_PLAYLIST: Track[] = [
  { key: "d0", title: "Resonance", artist: "HOME", videoId: "8GW6sLrK40k" },
  { key: "d1", title: "Crystal Skies", artist: "VXLLAIN, iGRES, ENXK", videoId: "qsD-nh0BJsQ" },
  { key: "d2", title: "Simpsonwave 1995", artist: "FrankJavCee", videoId: "EuVTt-M3IXo" },
  { key: "d3", title: "Liminal Space Music", artist: "Dreamcore / Weirdcore", videoId: "sJnsxAF6Zoo" },
  { key: "d4", title: "Complete Music Mix", artist: "Frutiger Aero", videoId: "J_BwEIjCGHc" },
  { key: "d5", title: "Hide (CS01 Version)", artist: "Dorian Concept", videoId: "tlFolRo1WiE" },
];

export default function BackgroundMusicPlayer() {
  const { user } = useAuth();

  const playlist = useMediaPlaylist(
    { get: getTracksApi, add: addTrackApi, update: updateTrackApi, remove: deleteTrackApi },
    !!user?.uid
  );

  // Combined view: fixed defaults followed by the user's saved tracks.
  const combined: Track[] = [
    ...DEFAULT_PLAYLIST,
    ...playlist.items.map((t) => ({
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
  const [currentKey, setCurrentKey] = useState<string>("d0");
  const [volume, setVolume] = useState(50);

  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrubbingRef = useRef(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Refs so the YT event callbacks always read fresh values.
  const combinedRef = useRef(combined);
  combinedRef.current = combined;
  const currentKeyRef = useRef(currentKey);
  currentKeyRef.current = currentKey;

  const currentIndex = () => {
    const i = combinedRef.current.findIndex((t) => t.key === currentKeyRef.current);
    return i < 0 ? 0 : i;
  };

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
            else if (e.data === YT.PlayerState.ENDED) playByIndex(currentIndex() + 1);
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

  // Poll playback position for the progress bar.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || scrubbingRef.current) return;
      setDuration(p.getDuration?.() ?? 0);
      setElapsed(p.getCurrentTime?.() ?? 0);
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const playByIndex = (i: number) => {
    const list = combinedRef.current;
    if (!list.length || !playerRef.current) return;
    const item = list[((i % list.length) + list.length) % list.length];
    setCurrentKey(item.key);
    currentKeyRef.current = item.key;
    setElapsed(0);
    setDuration(0);
    playerRef.current.loadVideoById(item.videoId);
    playerRef.current.playVideo();
  };

  const playByKey = (key: string) => {
    const idx = combinedRef.current.findIndex((t) => t.key === key);
    if (idx >= 0) playByIndex(idx);
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    playerRef.current?.setVolume(v);
  };

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
      await playlist.add(newUrl.trim(), newTitle.trim() || undefined);
      setNewUrl("");
      setNewTitle("");
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add track.");
    } finally {
      setAdding(false);
    }
  };

  const track = combined[currentIndex()] ?? DEFAULT_PLAYLIST[0];
  const seekMax = duration > 0 ? duration : 0;
  const seekPct = seekMax ? (Math.min(elapsed, seekMax) / seekMax) * 100 : 0;
  const activeSavedId = track.savedId ?? null;

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
                  background: `linear-gradient(to right, var(--accent-color) ${seekPct}%, rgba(255,255,255,0.15) ${seekPct}%)`,
                }}
              />
              <div className="music-time">
                <span>{formatTime(elapsed)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="music-controls">
              <button onClick={() => playByIndex(currentIndex() - 1)} disabled={!ready} aria-label="Previous">
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
              <button onClick={() => playByIndex(currentIndex() + 1)} disabled={!ready} aria-label="Next">
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

            {/* Default tracks */}
            <div className="media-section-label">Starter playlist</div>
            <div className="media-list">
              {DEFAULT_PLAYLIST.map((t) => (
                <div
                  key={t.key}
                  className={`media-row ${currentKey === t.key ? "active" : ""}`}
                >
                  <button className="media-main media-main--nogrip" onClick={() => playByKey(t.key)}>
                    <span className="media-index">
                      {currentKey === t.key && playing ? (
                        <span className="music-bars">
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : (
                        "♪"
                      )}
                    </span>
                    <span className="media-meta">
                      <span className="media-title">{t.title}</span>
                      <span className="media-artist">{t.artist}</span>
                    </span>
                  </button>
                </div>
              ))}
            </div>

            {/* User tracks — draggable + full CRUD */}
            {user && (
              <>
                <div className="media-section-label">Your tracks</div>
                <DraggablePlaylist
                  items={playlist.items}
                  activeId={activeSavedId}
                  playing={playing}
                  emptyText="No saved tracks yet"
                  onPlay={playByKey}
                  onRename={playlist.rename}
                  onDelete={playlist.remove}
                  onReorder={playlist.reorder}
                />

                {showAdd ? (
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
                      <button type="submit" className="music-add-save" disabled={adding || !newUrl.trim()}>
                        {adding ? <Loader2 size={13} className="animate-spin" /> : "Add"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button className="music-add-btn" onClick={() => setShowAdd(true)}>
                    <Plus size={14} /> Add your own music
                  </button>
                )}
              </>
            )}
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
