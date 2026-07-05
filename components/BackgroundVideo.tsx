"use client";

import { useEffect, useRef, useState } from "react";
import {
  Film,
  Monitor,
  Blend,
  Video,
  Volume2,
  VolumeX,
  Power,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  getLecturesApi,
  addLectureApi,
  updateLectureApi,
  deleteLectureApi,
} from "../lib/apiClient";
import { loadYouTubeApi, parseYouTubeId, formatTime, type YTPlayer } from "../lib/youtube";
import { useMediaPlaylist } from "../lib/useMediaPlaylist";
import DraggablePlaylist from "./DraggablePlaylist";

// The three preset "mix" modes → website opacity in front of the video.
const MODE_FULL_WEBSITE = 1;
const MODE_BALANCED = 0.5;
const MODE_FULL_VIDEO = 0.12;

const LS_KEY = "bgVideo";

type Persisted = {
  url: string;
  videoId: string | null;
  active: boolean;
  opacity: number;
  muted: boolean;
  activeLectureId: string | null;
};

export default function BackgroundVideo() {
  const { user } = useAuth();
  const lectures = useMediaPlaylist(
    { get: getLecturesApi, add: addLectureApi, update: updateLectureApi, remove: deleteLectureApi },
    !!user?.uid
  );

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [opacity, setOpacity] = useState(MODE_BALANCED);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Player + progress
  const playerRef = useRef<YTPlayer | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const scrubbingRef = useRef(false);

  const videoIdRef = useRef(videoId);
  videoIdRef.current = videoId;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // Add-lecture form
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Restore previous session.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        setUrl(p.url ?? "");
        setVideoId(p.videoId ?? null);
        setActive(Boolean(p.active) && Boolean(p.videoId));
        setOpacity(typeof p.opacity === "number" ? p.opacity : MODE_BALANCED);
        setMuted(p.muted ?? true);
        setActiveLectureId(p.activeLectureId ?? null);
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // Drive website opacity via a CSS variable the layout reads.
  useEffect(() => {
    const root = document.documentElement;
    if (active && videoId) {
      root.style.setProperty("--site-opacity", String(opacity));
      document.body.classList.add("has-bg-video");
    } else {
      root.style.setProperty("--site-opacity", "1");
      document.body.classList.remove("has-bg-video");
    }
  }, [active, videoId, opacity]);

  // Persist.
  useEffect(() => {
    if (!hydrated.current) return;
    const p: Persisted = { url, videoId, active, opacity, muted, activeLectureId };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, [url, videoId, active, opacity, muted, activeLectureId]);

  // Create / destroy the background player when it turns on/off.
  useEffect(() => {
    if (!active || !videoId) return;
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return;
      const id = videoIdRef.current!;
      playerRef.current = new window.YT.Player(hostRef.current, {
        height: "100%",
        width: "100%",
        videoId: id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          loop: 1,
          playlist: id,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          mute: mutedRef.current ? 1 : 0,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            if (mutedRef.current) playerRef.current?.mute();
            else playerRef.current?.unMute();
            playerRef.current?.playVideo();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      setReady(false);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Swap the video without recreating the player.
  useEffect(() => {
    if (active && ready && playerRef.current && videoId) {
      playerRef.current.loadVideoById(videoId);
      setElapsed(0);
      setDuration(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Reflect the mute toggle.
  useEffect(() => {
    if (playerRef.current && ready) {
      if (muted) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  }, [muted, ready]);

  // Poll playback position for the seek bar.
  useEffect(() => {
    if (!active || !ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || scrubbingRef.current) return;
      setDuration(p.getDuration?.() ?? 0);
      setElapsed(p.getCurrentTime?.() ?? 0);
    }, 500);
    return () => window.clearInterval(id);
  }, [active, ready]);

  const applyUrl = () => {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("Could not find a YouTube video ID in that link.");
      return;
    }
    setError(null);
    setVideoId(id);
    setActiveLectureId(null);
    setActive(true);
  };

  const playLecture = (id: string) => {
    const lec = lectures.items.find((l) => l.id === id);
    if (!lec) return;
    setVideoId(lec.videoId);
    setUrl(`https://youtu.be/${lec.videoId}`);
    setActiveLectureId(id);
    setActive(true);
  };

  const handleAddLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await lectures.add(newUrl.trim(), newTitle.trim() || undefined);
      setNewUrl("");
      setNewTitle("");
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add lecture.");
    } finally {
      setAdding(false);
    }
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

  const embedActive = active && videoId;
  const seekMax = duration > 0 ? duration : 0;
  const seekPct = seekMax ? (Math.min(elapsed, seekMax) / seekMax) * 100 : 0;
  const pct = Math.round(opacity * 100);

  return (
    <>
      {/* Full-viewport video layer, pinned behind everything (z-index:-1). */}
      {embedActive && (
        <div className="bgv-layer" aria-hidden>
          <div ref={hostRef} className="bgv-frame" />
        </div>
      )}

      {/* Interactive red seek bar along the bottom of the screen. */}
      {embedActive && (
        <div className="bgv-seekbar">
          <input
            className="bgv-seek"
            type="range"
            min={0}
            max={seekMax || 100}
            step={1}
            value={Math.min(elapsed, seekMax || 100)}
            disabled={!ready || seekMax === 0}
            onChange={(e) => onSeekInput(Number(e.target.value))}
            onMouseUp={(e) => onSeekCommit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => onSeekCommit(Number((e.target as HTMLInputElement).value))}
            aria-label="Seek video"
            style={{
              background: `linear-gradient(to right, #ff0000 ${seekPct}%, rgba(255,255,255,0.25) ${seekPct}%)`,
            }}
          />
          <div className="bgv-seek-time">
            {formatTime(elapsed)} / {formatTime(duration)}
          </div>
        </div>
      )}

      {/* Floating control widget — always fully opaque, top-right. */}
      <div className="bgv-widget">
        {open && (
          <div className="bgv-panel">
            <div className="bgv-panel-header">
              <span className="bgv-panel-title">
                <Film size={13} /> Background Video
              </span>
              <button className="bgv-close" onClick={() => setOpen(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            <div className="bgv-input-row">
              <input
                className="bgv-input"
                type="text"
                placeholder="Paste a YouTube video or lecture link…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyUrl();
                }}
              />
              <button className="bgv-set" onClick={applyUrl}>
                Set
              </button>
            </div>
            {error && <div className="bgv-error">{error}</div>}

            {/* Three mix-mode buttons */}
            <div className="bgv-modes">
              <button
                className={`bgv-mode ${opacity >= 0.99 ? "active" : ""}`}
                onClick={() => setOpacity(MODE_FULL_WEBSITE)}
                disabled={!videoId}
                title="Full website — hide the video"
              >
                <Monitor size={16} />
                <span>Website</span>
              </button>
              <button
                className={`bgv-mode ${opacity > MODE_FULL_VIDEO && opacity < 0.99 ? "active" : ""}`}
                onClick={() => setOpacity(MODE_BALANCED)}
                disabled={!videoId}
                title="Balanced — both visible"
              >
                <Blend size={16} />
                <span>Balanced</span>
              </button>
              <button
                className={`bgv-mode ${opacity <= MODE_FULL_VIDEO ? "active" : ""}`}
                onClick={() => setOpacity(MODE_FULL_VIDEO)}
                disabled={!videoId}
                title="Full video — fade the website back"
              >
                <Video size={16} />
                <span>Video</span>
              </button>
            </div>

            {/* Fine opacity control */}
            <div className="bgv-opacity">
              <div className="bgv-opacity-label">
                <span>Website opacity</span>
                <span>{pct}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={pct}
                disabled={!videoId}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                aria-label="Website opacity"
              />
            </div>

            <div className="bgv-footer">
              <button
                className="bgv-mute"
                onClick={() => setMuted((m) => !m)}
                disabled={!active}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                <span>{muted ? "Muted" : "Sound on"}</span>
              </button>
              {active ? (
                <button className="bgv-power off" onClick={() => setActive(false)}>
                  <Power size={15} /> Turn off
                </button>
              ) : (
                <button
                  className="bgv-power on"
                  onClick={() => videoId && setActive(true)}
                  disabled={!videoId}
                >
                  <Power size={15} /> Turn on
                </button>
              )}
            </div>

            {/* Saved lectures playlist */}
            {user && (
              <div className="bgv-lectures">
                <div className="media-section-label">Your lectures</div>
                <DraggablePlaylist
                  items={lectures.items}
                  activeId={activeLectureId}
                  playing={active && ready}
                  emptyText="No saved lectures yet"
                  onPlay={playLecture}
                  onRename={lectures.rename}
                  onDelete={lectures.remove}
                  onReorder={lectures.reorder}
                />

                {showAdd ? (
                  <form className="music-add-form" onSubmit={handleAddLecture}>
                    <input
                      className="music-add-input"
                      type="text"
                      placeholder="Paste a lecture link…"
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
                    <Plus size={14} /> Save a lecture
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <button
          className={`bgv-toggle ${active ? "on" : ""}`}
          onClick={() => setOpen((v) => !v)}
          title="Background video"
          aria-label="Background video"
        >
          <Film size={18} />
        </button>
      </div>
    </>
  );
}
