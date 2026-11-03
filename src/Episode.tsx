import React, { Fragment } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { OverlayRoot } from "./components/Overlay";
import { TimelineContext, VolumeContext } from "./context";
import { SceneView } from "./Scenes";
import { Timeline, TRANSITION } from "./timeline";

/**
 * `episodeId` names the folder in public/episodes/; the timeline is loaded from it before rendering.
 * `volume` scales every sound (1 = as mixed).
 */
export type EpisodeProps = { episodeId: string; timeline: Timeline | null; volume?: number };

const DUCK_PAD = 6;

/** BGM volume: quieter while someone is speaking, fading at both ends. */
const bgmVolume = (timeline: Timeline) => (frame: number) => {
  const distance = Math.min(
    ...timeline.lines.map((l) => {
      if (frame >= l.globalStart && frame < l.globalStart + l.frames) return 0;
      return frame < l.globalStart ? l.globalStart - frame : frame - (l.globalStart + l.frames);
    }),
  );
  const base = interpolate(distance, [0, DUCK_PAD], [0.06, 0.16], { extrapolateRight: "clamp" });
  const fade = interpolate(frame, [0, 15, timeline.total - 30, timeline.total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return base * fade;
};

export const Episode: React.FC<EpisodeProps> = ({ timeline, volume = 1 }) => {
  if (!timeline) return null;
  return (
    <TimelineContext.Provider value={timeline}>
      <VolumeContext.Provider value={volume}>
        <AbsoluteFill style={{ backgroundColor: "#14142b" }}>
          <TransitionSeries>
            {timeline.scenes.map((scene, i) => (
              <Fragment key={scene.id}>
                {i > 0 && (
                  <TransitionSeries.Transition
                    presentation={slide({ direction: i % 2 ? "from-right" : "from-bottom" })}
                    timing={linearTiming({ durationInFrames: TRANSITION })}
                  />
                )}
                <TransitionSeries.Sequence durationInFrames={scene.duration}>
                  <SceneView scene={scene} index={i} />
                </TransitionSeries.Sequence>
              </Fragment>
            ))}
          </TransitionSeries>
          <OverlayRoot />
          {timeline.lines.map((line) => (
            <Sequence key={line.id} from={line.globalStart} durationInFrames={line.frames} layout="none">
              <Audio src={staticFile(line.file)} volume={volume} />
            </Sequence>
          ))}
          <Audio src={staticFile("audio/bgm.wav")} loop volume={(f) => bgmVolume(timeline)(f) * volume} />
        </AbsoluteFill>
      </VolumeContext.Provider>
    </TimelineContext.Provider>
  );
};
