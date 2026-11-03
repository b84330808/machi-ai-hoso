import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Demo, DemoProps } from "./demo/Demo";
import { buildPlan, ClipLog, NarrationLine } from "./demo/plan";
import { Episode as EpisodeView, EpisodeProps } from "./Episode";
import { loadTimeline } from "./load";
import { FPS, Timeline } from "./timeline";
import { layout } from "./theme";

const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = async ({ props }) => {
  const timeline = await loadTimeline(props.episodeId);
  return { durationInFrames: timeline.total, props: { ...props, timeline } };
};

const DEMO_CLIPS = ["site", "make", "result", "audiences", "towns"];

/** The submission video needs demo/record.mjs recordings and demo/narrate.py narration in public/demo/. */
const calculateDemo: CalculateMetadataFunction<DemoProps> = async () => {
  const getJson = async (path: string) => {
    const res = await fetch(staticFile(path));
    if (!res.ok) throw new Error(`${path} missing. Run \`node demo/record.mjs\` and \`python demo/narrate.py\` first.`);
    return res.json();
  };
  const clips: Record<string, ClipLog> = Object.fromEntries(await Promise.all(DEMO_CLIPS.map(async (c) => [c, await getJson(`demo/${c}.events.json`)])));
  const voices: Record<string, NarrationLine> = await getJson("demo/narration/manifest.json");
  const ids = new Set(Object.values(clips).flatMap((c) => c.events.map((e) => e.episodeId).filter((id): id is string => !!id)));
  const timelines: Record<string, Timeline> = Object.fromEntries(await Promise.all([...ids].map(async (id) => [id, await loadTimeline(id)])));
  const plan = buildPlan(clips, voices, timelines);
  return { durationInFrames: Math.ceil(plan.total * FPS), props: { plan, timelines } };
};

export const RemotionRoot: React.FC = () => (
  <>
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
    <Composition id="Demo" component={Demo} durationInFrames={1} fps={FPS} width={1920} height={1080} defaultProps={{ plan: null, timelines: {} }} calculateMetadata={calculateDemo} />
  </>
);
