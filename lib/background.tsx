"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import AppearanceModal from "../components/AppearanceModal";

export type BgType = "default" | "color" | "gradient" | "image";
export type ImageFit = "cover" | "contain" | "repeat";

export interface BgSettings {
  type: BgType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  animateGradient: boolean;
  imageUrl: string; // http(s) URL or data URL (image or gif)
  imageFit: ImageFit;
  overlay: number; // 0..0.8 dark scrim for readability

  // Note-taking area
  editorCustom: boolean; // override the editor's default gradient
  editorFrom: string;
  editorTo: string;
  editorAngle: number;
  editorOpacity: number; // 0..1 — lower lets the app background show through
  textColor: string; // "" = default; applied to app + note text everywhere
}

export const DEFAULT_SETTINGS: BgSettings = {
  type: "default",
  color: "#1e0031",
  gradientFrom: "#1e0031",
  gradientTo: "#004a7a",
  gradientAngle: 135,
  animateGradient: true,
  imageUrl: "",
  imageFit: "cover",
  overlay: 0.3,

  editorCustom: false,
  editorFrom: "#0b132b",
  editorTo: "#ffffff",
  editorAngle: 180,
  editorOpacity: 1,
  textColor: "",
};

const LS_KEY = "appBackground";

// Convert "#rrggbb" (+ alpha 0..1) to an rgba() string.
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Turn the saved settings into an inline style for the fixed background layer.
export function computeBackgroundStyle(s: BgSettings): CSSProperties {
  if (s.type === "color") return { background: s.color };

  if (s.type === "gradient") {
    const base = `linear-gradient(${s.gradientAngle}deg, ${s.gradientFrom}, ${s.gradientTo})`;
    return s.animateGradient
      ? { background: base, backgroundSize: "400% 400%", animation: "gradientBG 15s ease infinite" }
      : { background: base };
  }

  if (s.type === "image" && s.imageUrl) {
    const scrim =
      s.overlay > 0
        ? `linear-gradient(rgba(0,0,0,${s.overlay}),rgba(0,0,0,${s.overlay})), `
        : "";
    if (s.imageFit === "repeat") {
      return {
        backgroundImage: `${scrim}url("${s.imageUrl}")`,
        backgroundRepeat: "repeat",
      };
    }
    return {
      backgroundImage: `${scrim}url("${s.imageUrl}")`,
      backgroundSize: s.imageFit,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }

  return {};
}

interface BackgroundContextValue {
  open: () => void;
}

const BackgroundContext = createContext<BackgroundContextValue>({ open: () => {} });
export const useBackground = () => useContext(BackgroundContext);

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<BgSettings>(DEFAULT_SETTINGS);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch {
      // Most likely a too-large uploaded image; it still applies this session.
    }
  }, [settings, hydrated]);

  // Apply note-area gradient / transparency and global text color via CSS
  // variables that globals.css reads (with sensible fallbacks when unset).
  useEffect(() => {
    const root = document.documentElement;

    if (settings.editorCustom) {
      const from = hexToRgba(settings.editorFrom, settings.editorOpacity);
      const to = hexToRgba(settings.editorTo, settings.editorOpacity);
      root.style.setProperty(
        "--editor-bg",
        `linear-gradient(${settings.editorAngle}deg, ${from}, ${to})`
      );
      // Make BlockNote's own editor surface transparent so the customizable
      // (and see-through) note background shows instead of a white rectangle.
      root.style.setProperty("--editor-bn-bg", "transparent");
    } else {
      root.style.removeProperty("--editor-bg");
      root.style.removeProperty("--editor-bn-bg");
    }

    if (settings.textColor) {
      root.style.setProperty("--text-primary", settings.textColor);
      root.style.setProperty("--editor-text", settings.textColor);
      root.style.setProperty("--editor-title", settings.textColor);
    } else {
      root.style.removeProperty("--text-primary");
      root.style.removeProperty("--editor-text");
      root.style.removeProperty("--editor-title");
    }
  }, [settings]);

  return (
    <BackgroundContext.Provider value={{ open: () => setOpen(true) }}>
      {settings.type !== "default" && (
        <div className="app-bg-layer" style={computeBackgroundStyle(settings)} aria-hidden />
      )}
      {children}
      {open && (
        <AppearanceModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setOpen(false)}
        />
      )}
    </BackgroundContext.Provider>
  );
}
