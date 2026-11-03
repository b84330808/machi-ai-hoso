import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { Episode as EpisodeView, EpisodeProps } from "./Episode";
import { loadTimeline } from "./load";
import { FPS } from "./timeline";
import { layout } from "./theme";

const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = async ({ props }) => {
  const timeline = await loadTimeline(props.episodeId);
  return { durationInFrames: timeline.total, props: { ...props, timeline } };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Episode"
    component={EpisodeView}
    durationInFrames={1}
    fps={FPS}
    width={layout.width}
    height={layout.height}
    defaultProps={{ episodeId: "sample-kyushokuhi", timeline: null }}
    calculateMetadata={calculateMetadata}
  />
);
