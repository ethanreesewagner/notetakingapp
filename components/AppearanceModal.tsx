"use client";

import { useRef, useState } from "react";
import { X, Wallpaper, Droplet, Blend, Image as ImageIcon, Upload, Check } from "lucide-react";
import { DEFAULT_SETTINGS, type BgSettings, type BgType, type ImageFit } from "../lib/background";

const COLOR_SWATCHES = [
  "#1e0031", "#0f172a", "#111827", "#1a1a2e",
  "#2d1b4e", "#0d3b2e", "#3b0d1a", "#4a148c",
  "#00363a", "#263238", "#000000", "#e2e8f0",
];

const GRADIENT_PRESETS: { from: string; to: string; angle: number }[] = [
  { from: "#1e0031", to: "#004a7a", angle: 135 },
  { from: "#8e2de2", to: "#4a00e0", angle: 135 },
  { from: "#0f2027", to: "#2c5364", angle: 135 },
  { from: "#ff512f", to: "#dd2476", angle: 135 },
  { from: "#11998e", to: "#38ef7d", angle: 135 },
  { from: "#fc5c7d", to: "#6a82fb", angle: 135 },
  { from: "#232526", to: "#414345", angle: 135 },
  { from: "#f7971e", to: "#ffd200", angle: 135 },
];

// Turn an uploaded file into a data URL. GIFs are kept as-is (to preserve
// animation); other images are downscaled to keep localStorage happy.
function fileToDataUrl(file: File, max = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image or GIF file."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === "image/gif") {
        if (dataUrl.length > 3_000_000) {
          reject(new Error("That GIF is large — it may not save. Try a URL instead."));
          return;
        }
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error("That image could not be loaded."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing is not supported here."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

const TABS: { type: BgType; label: string; icon: React.ReactNode }[] = [
  { type: "default", label: "Default", icon: <Wallpaper size={15} /> },
  { type: "color", label: "Color", icon: <Droplet size={15} /> },
  { type: "gradient", label: "Gradient", icon: <Blend size={15} /> },
  { type: "image", label: "Image / GIF", icon: <ImageIcon size={15} /> },
];

export default function AppearanceModal({
  settings,
  onChange,
  onClose,
}: {
  settings: BgSettings;
  onChange: (s: BgSettings) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const patch = (p: Partial<BgSettings>) => onChange({ ...settings, ...p });

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      patch({ type: "image", imageUrl: await fileToDataUrl(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that image.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="appearance-overlay" onClick={onClose}>
      <div className="appearance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="appearance-header">
          <span className="appearance-title">
            <Wallpaper size={16} /> App background
          </span>
          <button className="appearance-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="appearance-error">{error}</div>}

        {/* Tabs */}
        <div className="appearance-tabs">
          {TABS.map((t) => (
            <button
              key={t.type}
              className={`appearance-tab ${settings.type === t.type ? "active" : ""}`}
              onClick={() => patch({ type: t.type })}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="appearance-body">
          {settings.type === "default" && (
            <p className="appearance-hint">
              The original animated purple-blue gradient. Pick another tab to customize.
            </p>
          )}

          {settings.type === "color" && (
            <>
              <div className="appearance-swatches">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    className={`appearance-swatch ${settings.color === c ? "active" : ""}`}
                    style={{ background: c }}
                    onClick={() => patch({ color: c })}
                    aria-label={c}
                  >
                    {settings.color === c && <Check size={14} />}
                  </button>
                ))}
              </div>
              <label className="appearance-row">
                <span>Custom color</span>
                <input
                  type="color"
                  value={settings.color}
                  onChange={(e) => patch({ color: e.target.value })}
                />
              </label>
            </>
          )}

          {settings.type === "gradient" && (
            <>
              <div className="appearance-swatches">
                {GRADIENT_PRESETS.map((g, i) => (
                  <button
                    key={i}
                    className="appearance-swatch gradient"
                    style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` }}
                    onClick={() =>
                      patch({ gradientFrom: g.from, gradientTo: g.to, gradientAngle: g.angle })
                    }
                    aria-label={`Gradient ${i + 1}`}
                  />
                ))}
              </div>
              <label className="appearance-row">
                <span>From</span>
                <input
                  type="color"
                  value={settings.gradientFrom}
                  onChange={(e) => patch({ gradientFrom: e.target.value })}
                />
              </label>
              <label className="appearance-row">
                <span>To</span>
                <input
                  type="color"
                  value={settings.gradientTo}
                  onChange={(e) => patch({ gradientTo: e.target.value })}
                />
              </label>
              <label className="appearance-row">
                <span>Angle · {settings.gradientAngle}°</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={settings.gradientAngle}
                  onChange={(e) => patch({ gradientAngle: Number(e.target.value) })}
                />
              </label>
              <label className="appearance-row">
                <span>Animate</span>
                <input
                  type="checkbox"
                  checked={settings.animateGradient}
                  onChange={(e) => patch({ animateGradient: e.target.checked })}
                />
              </label>
            </>
          )}

          {settings.type === "image" && (
            <>
              <div className="appearance-image-actions">
                <input
                  className="appearance-input"
                  type="text"
                  placeholder="Paste an image or GIF URL…"
                  value={settings.imageUrl.startsWith("data:") ? "" : settings.imageUrl}
                  onChange={(e) => patch({ imageUrl: e.target.value })}
                />
                <button className="fc-btn" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} /> Upload
                </button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
              </div>
              {settings.imageUrl.startsWith("data:") && (
                <p className="appearance-hint">Using an uploaded image.</p>
              )}

              <label className="appearance-row">
                <span>Fit</span>
                <select
                  className="appearance-select"
                  value={settings.imageFit}
                  onChange={(e) => patch({ imageFit: e.target.value as ImageFit })}
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="repeat">Tile</option>
                </select>
              </label>
              <label className="appearance-row">
                <span>Darken · {Math.round(settings.overlay * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={Math.round(settings.overlay * 100)}
                  onChange={(e) => patch({ overlay: Number(e.target.value) / 100 })}
                />
              </label>
              <p className="appearance-hint">Tip: GIFs work best pasted as a URL.</p>
            </>
          )}
        </div>

        {/* ── Note-taking area ─────────────────────────────────────── */}
        <div className="appearance-divider" />
        <div className="appearance-section-title">Note-taking area</div>

        <label className="appearance-row">
          <span>Customize note background</span>
          <input
            type="checkbox"
            checked={settings.editorCustom}
            onChange={(e) => patch({ editorCustom: e.target.checked })}
          />
        </label>

        {settings.editorCustom && (
          <>
            <label className="appearance-row">
              <span>From</span>
              <input
                type="color"
                value={settings.editorFrom}
                onChange={(e) => patch({ editorFrom: e.target.value })}
              />
            </label>
            <label className="appearance-row">
              <span>To</span>
              <input
                type="color"
                value={settings.editorTo}
                onChange={(e) => patch({ editorTo: e.target.value })}
              />
            </label>
            <label className="appearance-row">
              <span>Angle · {settings.editorAngle}°</span>
              <input
                type="range"
                min={0}
                max={360}
                value={settings.editorAngle}
                onChange={(e) => patch({ editorAngle: Number(e.target.value) })}
              />
            </label>
            <label className="appearance-row">
              <span>See-through · {Math.round((1 - settings.editorOpacity) * 100)}%</span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round(settings.editorOpacity * 100)}
                onChange={(e) => patch({ editorOpacity: Number(e.target.value) / 100 })}
              />
            </label>
          </>
        )}

        <div className="appearance-section-title">Text color</div>
        <div className="appearance-swatches">
          <button
            className={`appearance-swatch text-default ${settings.textColor === "" ? "active" : ""}`}
            onClick={() => patch({ textColor: "" })}
            title="Default"
          >
            {settings.textColor === "" ? <Check size={14} /> : "A"}
          </button>
          {["#ffffff", "#111827", "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#c084fc"].map((c) => (
            <button
              key={c}
              className={`appearance-swatch ${settings.textColor === c ? "active" : ""}`}
              style={{ background: c, color: c === "#ffffff" ? "#111" : "#fff" }}
              onClick={() => patch({ textColor: c })}
              aria-label={c}
            >
              {settings.textColor === c && <Check size={14} />}
            </button>
          ))}
        </div>
        <label className="appearance-row">
          <span>Custom text color</span>
          <input
            type="color"
            value={settings.textColor || "#ffffff"}
            onChange={(e) => patch({ textColor: e.target.value })}
          />
        </label>

        <div className="appearance-footer">
          <button className="fc-btn ghost" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
            Reset
          </button>
          <button className="fc-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
