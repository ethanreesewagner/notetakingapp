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
};

const LS_KEY = "appBackground";

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
