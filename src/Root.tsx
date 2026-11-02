import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Episode as EpisodeView, EpisodeProps } from "./Episode";
import { Episode } from "./schema";
import { buildTimeline, FPS, Manifest } from "./timeline";
import { layout } from "./theme";

const fetchJson = async (path: string) => {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`${path} missing. Run \`npm run tts -- episodes/<name>.json\` first.`);
  return res.json();
};

const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = async () => {
  const episode = Episode.parse(await fetchJson("episode.json"));
  const manifest = (await fetchJson("audio/manifest.json")) as Manifest;
  const timeline = buildTimeline(episode, manifest);
  return { durationInFrames: timeline.total, props: { timeline } };
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Episode"
    component={EpisodeView}
    durationInFrames={1}
    fps={FPS}
    width={layout.width}
    height={layout.height}
    defaultProps={{ timeline: null }}
    calculateMetadata={calculateMetadata}
  />
);
