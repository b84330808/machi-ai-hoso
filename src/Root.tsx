import React from "react";
import { Composition } from "remotion";
import { Episode } from "./Episode";
import { FPS, timeline } from "./timeline";
import { layout } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode}
    durationInFrames={timeline.total}
    fps={FPS}
    width={layout.width}
    height={layout.height}
  />
);
