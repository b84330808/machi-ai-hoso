import { createContext, useContext } from "react";
import type { Timeline } from "./timeline";

export const TimelineContext = createContext<Timeline | null>(null);

export const useTimeline = (): Timeline => {
  const timeline = useContext(TimelineContext);
  if (!timeline) throw new Error("Timeline not loaded");
  return timeline;
};

/** Multiplier for every sound in an episode; the submission video lowers it under its own narration. */
export const VolumeContext = createContext(1);
