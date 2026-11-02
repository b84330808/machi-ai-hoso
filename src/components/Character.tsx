import React from "react";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { Mouth, PixelSprite, SpriteDef } from "./PixelSprite";
import type { TimedLine } from "../timeline";

type Props = {
  sprite: SpriteDef;
  /** Lines of the current scene spoken by this character (scene-relative timing). */
  lines: TimedLine[];
  scale: number;
  blinkOffset?: number;
  style?: React.CSSProperties;
};

const blinkAt = (frame: number, offset: number) => (frame + offset) % 96 < 4;

/** Mouth shape from audio loudness, closed between words so pauses read clearly. */
const TalkingSprite: React.FC<Omit<Props, "lines"> & { line: TimedLine }> = ({ sprite, line, scale, blinkOffset = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(staticFile(line.file));
  const local = frame - line.start;
  const t = local / fps;

  let mouth: Mouth = "closed";
  const inWord = line.words.some((w) => t >= w.start - 0.03 && t <= w.end + 0.03);
  if (audioData && inWord) {
    const bins = visualizeAudio({ fps, frame: local, audioData, numberOfSamples: 16 });
    const level = bins.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
    mouth = level > 0.09 ? "open" : level > 0.035 ? "half" : "closed";
  }
  const bob = Math.sin(local / 3) * scale * 0.25;

  return (
    <PixelSprite
      sprite={sprite}
      scale={scale}
      mouth={mouth}
      blink={blinkAt(frame, blinkOffset)}
      style={{ ...style, transform: `${style?.transform ?? ""} translateY(${bob}px)` }}
    />
  );
};

export const Character: React.FC<Props> = ({ sprite, lines, scale, blinkOffset = 0, style }) => {
  const frame = useCurrentFrame();
  const active = lines.find((l) => frame >= l.start && frame < l.start + l.frames);
  if (active) return <TalkingSprite sprite={sprite} line={active} scale={scale} blinkOffset={blinkOffset} style={style} />;

  const idleBob = Math.sin(frame / 12) * scale * 0.15;
  return (
    <PixelSprite
      sprite={sprite}
      scale={scale}
      blink={blinkAt(frame, blinkOffset)}
      style={{ ...style, transform: `${style?.transform ?? ""} translateY(${idleBob}px)` }}
    />
  );
};
