import { loadFont as loadDotGothic } from "@remotion/google-fonts/DotGothic16";
import { loadFont as loadNotoSansJP } from "@remotion/google-fonts/NotoSansJP";

export const pixelFont = loadDotGothic().fontFamily;
export const bodyFont = loadNotoSansJP("normal", { weights: ["700", "900"] }).fontFamily;

export const colors = {
  ink: "#1a1a2e",
  panel: "#14142b",
  white: "#ffffff",
  cream: "#fff6e5",
  yellow: "#ffd23f",
  orange: "#ff8a3d",
  red: "#e8505b",
  blue: "#2f6fd6",
  sky: "#7fb2ff",
  green: "#3dbe7a",
};

// Layout of the 1080x1920 frame: animated stage on top, fixed lower panel for telops.
export const layout = {
  width: 1080,
  height: 1920,
  headerHeight: 150,
  stageBottom: 1120,
  telopTop: 1170,
  sourceTop: 1610,
};

/** Thick outline for telop text, built from text-shadows so it works on any Chromium. */
export const outline = (color: string, radius: number): string => {
  const steps = 16;
  const shadows: string[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    shadows.push(`${(Math.cos(a) * radius).toFixed(1)}px ${(Math.sin(a) * radius).toFixed(1)}px 0 ${color}`);
  }
  shadows.push(`0 ${radius + 4}px 0 ${color}`);
  return shadows.join(", ");
};
