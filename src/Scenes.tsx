import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Desk, Kitchen, Studio, TableFront } from "./components/Backgrounds";
import { Character } from "./components/Character";
import { PixelIcon } from "./components/PixelIcon";
import { ANCHOR, KID, PixelSprite } from "./components/PixelSprite";
import type { Visual } from "./schema";
import { TimedLine, TimedScene, wordFrame } from "./timeline";
import { bodyFont, colors, layout, outline, pixelFont } from "./theme";

type VisualOf<T extends Visual["type"]> = Extract<Visual, { type: T }>;
type VisualProps<T extends Visual["type"]> = { visual: VisualOf<T>; line: TimedLine; isFirst: boolean; layoutName: TimedScene["layout"] };

const formatNumber = (n: number) => Math.round(n).toLocaleString("ja-JP");

/**
 * Font size that fits generated text into a box: full-width characters are about 1em wide, others about 0.58em.
 * With lines > 1 the text may wrap, so it gets that many times the width.
 */
const fit = (text: string, maxWidth: number, base: number, lines = 1) => {
  const ems = [...text].reduce((sum, c) => sum + (c.charCodeAt(0) > 0xff ? 1 : 0.58), 0);
  return Math.min(base, Math.floor((maxWidth * lines) / Math.max(ems, 1)));
};

const Sfx: React.FC<{ at: number; name: "pop" | "ding" | "whoosh" | "stamp"; volume?: number }> = ({ at, name, volume = 0.5 }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={30} layout="none">
    <Audio src={staticFile(`audio/sfx_${name}.wav`)} volume={volume} />
  </Sequence>
);

const useSpring = (at: number, damping = 10, stiffness = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness } });
};

/** Frame the visual's key moment happens: at its trigger word, else shortly after the line starts. */
const useTrigger = (line: TimedLine, word: string | undefined, fallbackSeconds: number) => {
  const { fps } = useVideoConfig();
  return wordFrame(line, word, fps) ?? line.start + Math.round(fallbackSeconds * fps);
};

const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      position: "absolute",
      background: colors.white,
      border: `10px solid ${colors.ink}`,
      borderRadius: 24,
      boxShadow: `14px 14px 0 ${colors.ink}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: bodyFont,
      fontWeight: 900,
      color: colors.ink,
      textAlign: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

const CountUp: React.FC<{ from: number; to: number; start: number; frames: number; prefix?: string; unit: string; color: string; size: number }> = ({
  from,
  to,
  start,
  frames,
  prefix = "",
  unit,
  color,
  size,
}) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [start, start + frames], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const done = frame >= start + frames;
  const pulse = done ? 1 + 0.12 * Math.max(0, 1 - (frame - start - frames) / 8) : 1;
  return (
    <div style={{ fontSize: size, color, lineHeight: 1.1, transform: `scale(${pulse})`, whiteSpace: "nowrap" }}>
      {prefix}
      {formatNumber(value)}
      <span style={{ fontSize: size * 0.7 }}>{unit}</span>
    </div>
  );
};

/* ---------- Visuals ---------- */

const StampV: React.FC<VisualProps<"stamp">> = ({ visual, line }) => {
  const frame = useCurrentFrame();
  const stampAt = useTrigger(line, visual.at ?? line.emphasis?.[0], 1.0);
  const stamp = useSpring(stampAt, 9);
  const tag = useSpring(line.start - 4, 12);
  const shaking = frame >= stampAt && frame < stampAt + 8;
  const shake = shaking ? (random(`shake-${frame}`) - 0.5) * 24 : 0;
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${shake / 2}px)` }}>
      <Card style={{ left: 110, top: 245, width: 860, height: 285, paddingTop: 36, borderColor: colors.red, transform: `scale(${interpolate(stamp, [0, 1], [2.4, 1])}) rotate(-4deg)`, opacity: stamp > 0.01 ? 1 : 0 }}>
        <div style={{ fontSize: fit(visual.label, 780, 80), lineHeight: 1.15, whiteSpace: "nowrap" }}>{visual.label}</div>
        <div style={{ fontSize: fit(visual.big, 780, 170), lineHeight: 1, color: colors.red, whiteSpace: "nowrap" }}>{visual.big}</div>
      </Card>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 180,
          padding: "8px 28px",
          background: colors.yellow,
          border: `8px solid ${colors.ink}`,
          fontFamily: bodyFont,
          fontWeight: 900,
          fontSize: fit(visual.tag, 780, 52),
          color: colors.ink,
          whiteSpace: "nowrap",
          transform: `scale(${tag}) rotate(-3deg)`,
        }}
      >
        {visual.tag}
      </div>
      <Sfx at={stampAt} name="stamp" volume={0.8} />
    </div>
  );
};

const CounterV: React.FC<VisualProps<"counter">> = ({ visual, line, isFirst }) => {
  const enter = useSpring(line.start - 6, 13);
  const countStart = line.start + 10;
  const frames = 32;
  const transform = isFirst ? `scale(${enter})` : `translateX(${interpolate(enter, [0, 1], [1100, 0])}px)`;
  return (
    <>
      <Card style={{ left: 140, top: 220, width: 800, height: 540, transform }}>
        {visual.icon && <PixelIcon name={visual.icon} size={110} />}
        <div style={{ fontSize: fit(visual.label, 700, 56), marginTop: 6, whiteSpace: "nowrap" }}>{visual.label}</div>
        <CountUp
          from={visual.from}
          to={visual.to}
          start={countStart}
          frames={frames}
          prefix={visual.prefix}
          unit={visual.unit}
          color={isFirst ? colors.blue : colors.red}
          size={fit(`${visual.prefix ?? ""}${formatNumber(Math.max(visual.from, visual.to))}${visual.unit}`, 700, 140)}
        />
        {visual.note && <div style={{ fontSize: fit(visual.note, 700, 38, 2), color: "#666", marginTop: 10, padding: "0 30px", lineHeight: 1.3 }}>{visual.note}</div>}
      </Card>
      {!isFirst && <Sfx at={line.start - 6} name="whoosh" volume={0.35} />}
      <Sfx at={countStart + frames} name="ding" volume={0.45} />
    </>
  );
};

const PeopleV: React.FC<VisualProps<"people">> = ({ visual, line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = Math.min(4, Math.max(1, visual.count));
  const totalAt = useTrigger(line, visual.at, 1.2);
  const totalPop = useSpring(totalAt - 6, 12);
  const gap = 240;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const at = line.start + 4 + i * 10;
        const pop = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 220 } });
        const left = 540 - (count * gap) / 2 + i * gap + 40;
        return (
          <div key={i} style={{ position: "absolute", left, top: 210, transform: `scale(${pop})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PixelSprite sprite={KID} scale={10} blink={(frame + i * 40) % 96 < 4} />
            <div style={{ marginTop: 10, fontFamily: bodyFont, fontWeight: 900, fontSize: 32, background: colors.yellow, border: `5px solid ${colors.ink}`, borderRadius: 12, padding: "2px 12px", color: colors.ink, whiteSpace: "nowrap" }}>
              {visual.each}
            </div>
            <Sfx at={at} name="pop" volume={0.4} />
          </div>
        );
      })}
      {visual.total !== undefined && (
        <>
          <Card style={{ left: 170, top: 560, width: 740, height: 200, transform: `scale(${totalPop})` }}>
            <CountUp from={0} to={visual.total} start={totalAt} frames={30} prefix={visual.totalPrefix ? `${visual.totalPrefix} ` : ""} unit={visual.totalUnit ?? "円"} color={colors.red} size={110} />
          </Card>
          <Sfx at={totalAt + 30} name="ding" volume={0.45} />
        </>
      )}
    </>
  );
};

const CardV: React.FC<VisualProps<"card">> = ({ visual, line, isFirst }) => {
  const enter = useSpring(line.start - 4, 14, 170);
  const border = visual.icon === "warning" ? colors.orange : visual.icon === "check" ? colors.green : colors.blue;
  return (
    <>
      <Card style={{ left: 120, top: 300, width: 840, height: 300, borderColor: border, transform: `translateY(${interpolate(enter, [0, 1], [isFirst ? 800 : -800, 0])}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <PixelIcon name={visual.icon} size={100} />
          <div style={{ fontSize: fit(visual.title, 620, 66), whiteSpace: "nowrap" }}>{visual.title}</div>
        </div>
        {visual.note && <div style={{ fontSize: fit(visual.note, 740, 40, 2), color: "#666", marginTop: 16, padding: "0 30px", lineHeight: 1.3 }}>{visual.note}</div>}
      </Card>
      <Sfx at={line.start - 4} name="whoosh" volume={0.35} />
    </>
  );
};

const PointsV: React.FC<VisualProps<"points">> = ({ visual, line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = useSpring(line.start - 6, 12);
  const items = visual.items.slice(0, 3);
  return (
    <>
      <div style={{ position: "absolute", top: 200, width: "100%", textAlign: "center", fontFamily: pixelFont, fontSize: fit(visual.title, 900, 88), color: colors.yellow, textShadow: outline(colors.ink, 6), whiteSpace: "nowrap", transform: `scale(${title})` }}>
        {visual.title}
      </div>
      {items.map((item, i) => {
        const at = (wordFrame(line, item.at ?? item.text.slice(0, 2), fps) ?? line.start + Math.round((1.4 + i * 1.1) * fps)) - 4;
        const pop = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 200 } });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 120,
              top: 340 + i * 150,
              width: 760,
              height: 120,
              display: "flex",
              alignItems: "center",
              gap: 24,
              background: colors.white,
              border: `8px solid ${colors.ink}`,
              borderRadius: 18,
              boxShadow: `10px 10px 0 ${colors.ink}`,
              padding: "0 24px",
              fontFamily: bodyFont,
              fontWeight: 900,
              fontSize: fit(item.text, 580, 56),
              color: colors.ink,
              whiteSpace: "nowrap",
              transform: `translateX(${interpolate(pop, [0, 1], [900, 0])}px)`,
            }}
          >
            <div style={{ flexShrink: 0, width: 76, height: 76, borderRadius: 38, background: colors.red, color: colors.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, lineHeight: 1 }}>{i + 1}</div>
            {item.text}
            <Sfx at={at} name="pop" volume={0.4} />
          </div>
        );
      })}
    </>
  );
};

const QuestionV: React.FC<VisualProps<"question">> = ({ visual, line, layoutName }) => {
  const frame = useCurrentFrame();
  const at = useTrigger(line, visual.at, 1.0);
  const pop = useSpring(at, 8);
  const pos = layoutName === "skit" ? { left: 700, top: 330, size: 200 } : { left: 830, top: 470, size: 140 };
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: pos.left,
          top: pos.top,
          width: pos.size,
          height: pos.size,
          borderRadius: pos.size / 2,
          background: colors.white,
          border: `8px solid ${colors.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: pixelFont,
          fontSize: pos.size * 0.7,
          color: colors.red,
          transform: `scale(${pop}) rotate(${Math.sin(frame / 5) * 4}deg)`,
        }}
      >
        {visual.mark}
      </div>
      <Sfx at={at} name="pop" />
    </>
  );
};

const VisualView: React.FC<{ visual: Visual; line: TimedLine; isFirst: boolean; layoutName: TimedScene["layout"] }> = (props) => {
  const { visual } = props;
  switch (visual.type) {
    case "stamp":
      return <StampV {...props} visual={visual} />;
    case "counter":
      return <CounterV {...props} visual={visual} />;
    case "people":
      return <PeopleV {...props} visual={visual} />;
    case "card":
      return <CardV {...props} visual={visual} />;
    case "points":
      return <PointsV {...props} visual={visual} />;
    case "question":
      return <QuestionV {...props} visual={visual} />;
  }
};

/* ---------- Layouts ---------- */

/** Slow camera push-in across the whole scene. */
const PushIn: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1, 1.05]);
  return (
    <AbsoluteFill style={{ height: layout.stageBottom, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 60%" }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const ENTER = 8;
const EXIT = 10;

/** Slides a visual out to the left once the next one starts; `at` is undefined for the scene's last visual. */
const Leaving: React.FC<{ at?: number; children: React.ReactNode }> = ({ at, children }) => {
  const frame = useCurrentFrame();
  if (at === undefined) return <AbsoluteFill>{children}</AbsoluteFill>;
  const t = interpolate(frame, [at, at + EXIT], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  return <AbsoluteFill style={{ transform: `translateX(${-1100 * t}px)`, opacity: 1 - t }}>{children}</AbsoluteFill>;
};

/**
 * One main visual on screen at a time: each enters with its line and pushes the previous one out, so generated
 * scenes never stack cards on top of each other. Question marks are small overlays and stay.
 */
const Visuals: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const main = scene.lines.filter((l) => l.visual && l.visual.type !== "question");
  const questions = scene.lines.filter((l) => l.visual?.type === "question");
  return (
    <>
      {main.map((line, i) => {
        const next = main[i + 1];
        const leaveAt = next ? next.start - ENTER : undefined;
        if (frame < line.start - ENTER || (leaveAt !== undefined && frame >= leaveAt + EXIT)) return null;
        return (
          <Leaving key={line.id} at={leaveAt}>
            <VisualView visual={line.visual!} line={line} isFirst={i === 0} layoutName={scene.layout} />
          </Leaving>
        );
      })}
      {questions.map((line) =>
        frame >= line.start - ENTER ? <VisualView key={line.id} visual={line.visual!} line={line} isFirst={false} layoutName={scene.layout} /> : null,
      )}
    </>
  );
};

/** The kid hops in from the right for his lines in studio layouts. */
const KidCameo: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kidLines = scene.lines.filter((l) => l.speaker === "kid");
  if (kidLines.length === 0) return null;
  const first = kidLines[0];
  const pop = spring({ frame: frame - first.start + 6, fps, config: { damping: 7, stiffness: 160 } });
  const speaking = kidLines.some((l) => frame >= l.start && frame < l.start + l.frames);
  const jump = speaking ? -Math.abs(Math.sin((frame - first.start) / 4)) * 40 : 0;
  return (
    <div style={{ position: "absolute", left: 840, top: 640, transform: `scale(${pop}) translateY(${jump}px)` }}>
      <Character sprite={KID} lines={kidLines} scale={11} blinkOffset={20} />
    </div>
  );
};

const SkitLayout: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  return (
    <PushIn duration={scene.duration}>
      <Kitchen />
      <Character sprite={KID} lines={scene.lines.filter((l) => l.speaker === "kid")} scale={22} blinkOffset={30} style={{ position: "absolute", left: 300, top: 540 }} />
      {scene.prop && (
        <div
          style={{
            position: "absolute",
            left: 610,
            top: 660,
            width: 230,
            height: 280,
            background: colors.white,
            border: `8px solid ${colors.ink}`,
            transform: `rotate(${-8 + Math.sin(frame / 6) * 2}deg)`,
            fontFamily: pixelFont,
            padding: 18,
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: 34, color: colors.red }}>おたより</div>
          <div style={{ fontSize: 28, color: colors.ink, marginTop: 10, lineHeight: 1.3, whiteSpace: "pre-line" }}>{scene.prop.title}</div>
          <div style={{ marginTop: 14, height: 8, width: 150, background: "#ccc" }} />
          <div style={{ marginTop: 12, height: 8, width: 120, background: "#ccc" }} />
        </div>
      )}
      <TableFront />
      <Visuals scene={scene} />
    </PushIn>
  );
};

const AnchorLayout: React.FC<{ scene: TimedScene }> = ({ scene }) => (
  <PushIn duration={scene.duration}>
    <Studio />
    <Character sprite={ANCHOR} lines={scene.lines.filter((l) => l.speaker === "anchor")} scale={20} style={{ position: "absolute", left: 380, top: 580 }} />
    <Desk />
    <Visuals scene={scene} />
    <KidCameo scene={scene} />
  </PushIn>
);

const DeskLayout: React.FC<{ scene: TimedScene }> = ({ scene }) => (
  <PushIn duration={scene.duration}>
    <Studio dim={0.5} />
    <Character sprite={ANCHOR} lines={scene.lines.filter((l) => l.speaker === "anchor")} scale={12} style={{ position: "absolute", left: 40, top: 640 }} />
    <Desk />
    <Visuals scene={scene} />
    <KidCameo scene={scene} />
  </PushIn>
);

export const SceneView: React.FC<{ scene: TimedScene; index: number }> = ({ scene, index }) => (
  <AbsoluteFill>
    {scene.layout === "skit" ? <SkitLayout scene={scene} /> : scene.layout === "anchor" ? <AnchorLayout scene={scene} /> : <DeskLayout scene={scene} />}
    {index > 0 && <Sfx at={0} name="whoosh" volume={0.4} />}
  </AbsoluteFill>
);
