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
} from "lucide-react";

// Extract an 11-char YouTube video ID from common URL / share forms.
function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return null;
}

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
};

export default function BackgroundVideo() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [opacity, setOpacity] = useState(MODE_BALANCED);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Restore any previous session from localStorage.
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
      }
    } catch {
      /* ignore malformed storage */
    }
    hydrated.current = true;
  }, []);

  // Drive the website opacity via a CSS variable the layout reads, and toggle
  // a body class so we only dim the site while a background video is showing.
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

  // Persist state after hydration.
  useEffect(() => {
    if (!hydrated.current) return;
    const p: Persisted = { url, videoId, active, opacity, muted };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch {
      /* ignore quota errors */
    }
  }, [url, videoId, active, opacity, muted]);

  const applyUrl = () => {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("Could not find a YouTube video ID in that link.");
      return;
    }
    setError(null);
    setVideoId(id);
    setActive(true);
  };

  const disable = () => {
    setActive(false);
  };

  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&loop=1&playlist=${videoId}` +
      `&mute=${muted ? 1 : 0}&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3`
    : null;

  const pct = Math.round(opacity * 100);

  return (
    <>
      {/* Full-viewport video layer, pinned behind the entire site (z-index:-1). */}
      {active && embedSrc && (
        <div className="bgv-layer" aria-hidden>
          <iframe
            key={embedSrc}
            className="bgv-frame"
            src={embedSrc}
            title="Background video"
            allow="autoplay; encrypted-media"
            frameBorder={0}
          />
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
              <button
                className="bgv-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
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
                className={`bgv-mode ${
                  opacity > MODE_FULL_VIDEO && opacity < 0.99 ? "active" : ""
                }`}
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
                <button className="bgv-power off" onClick={disable}>
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
