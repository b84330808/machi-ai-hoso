import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, random, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Desk, Kitchen, Studio, TableFront } from "./components/Backgrounds";
import { Character } from "./components/Character";
import { ANCHOR, KID, PixelSprite } from "./components/PixelSprite";
import { TimedLine, TimedScene, wordTime } from "./timeline";
import { bodyFont, colors, layout, outline, pixelFont } from "./theme";

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

const Sfx: React.FC<{ at: number; name: "pop" | "ding" | "whoosh" | "stamp"; volume?: number }> = ({ at, name, volume = 0.5 }) => (
  <Sequence from={Math.max(0, Math.round(at))} durationInFrames={30} layout="none">
    <Audio src={staticFile(`audio/sfx_${name}.wav`)} volume={volume} />
  </Sequence>
);

/** Slow camera push-in across the whole scene. */
const PushIn: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, duration], [1, 1.05]);
  return <AbsoluteFill style={{ height: layout.stageBottom, overflow: "hidden" }}><AbsoluteFill style={{ transform: `scale(${scale})`, transformOrigin: "50% 60%" }}>{children}</AbsoluteFill></AbsoluteFill>;
};

const usePop = (at: number, damping = 10) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness: 200 } });
};

/** Frame inside the scene at which a word of the line is spoken (falls back to the line start + offset). */
const atWord = (line: TimedLine, needle: string, fps: number, fallback = 0) => {
  const t = wordTime(line, needle);
  return line.start + Math.round((t ?? fallback) * fps);
};

const AnchorSmall: React.FC<{ scene: TimedScene }> = ({ scene }) => (
  <Character sprite={ANCHOR} lines={scene.lines.filter((l) => l.speaker === "anchor")} scale={12} style={{ position: "absolute", left: 40, top: 640 }} />
);

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
      ...style,
    }}
  >
    {children}
  </div>
);

const ColdOpen: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = scene.lines[0];
  const bubbleAt = atWord(line, "上がる", fps, 1.2);
  const bubble = usePop(bubbleAt, 8);
  return (
    <PushIn duration={scene.duration}>
      <Kitchen />
      <Character sprite={KID} lines={scene.lines} scale={22} blinkOffset={30} style={{ position: "absolute", left: 300, top: 540 }} />
      {/* School letter in the kid's hand */}
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
        <div style={{ fontSize: 28, color: colors.ink, marginTop: 10, lineHeight: 1.3 }}>給食費の<br />お知らせ</div>
        <div style={{ marginTop: 14, height: 8, width: 150, background: "#ccc" }} />
        <div style={{ marginTop: 12, height: 8, width: 120, background: "#ccc" }} />
      </div>
      <TableFront />
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 330,
          width: 200,
          height: 200,
          borderRadius: 100,
          background: colors.white,
          border: `8px solid ${colors.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: pixelFont,
          fontSize: 140,
          color: colors.red,
          transform: `scale(${bubble}) rotate(${Math.sin(frame / 5) * 4}deg)`,
        }}
      >
        ？
      </div>
      <Sfx at={bubbleAt} name="pop" />
    </PushIn>
  );
};

const Hook: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = scene.lines[0];
  const stampAt = atWord(line, "月", fps, 1.0);
  const stamp = usePop(stampAt, 9);
  const tag = usePop(line.start - 4, 12);
  const shaking = frame >= stampAt && frame < stampAt + 8;
  const shake = shaking ? (random(`shake-${frame}`) - 0.5) * 24 : 0;
  return (
    <PushIn duration={scene.duration}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${shake / 2}px)` }}>
        <Studio />
        <Character sprite={ANCHOR} lines={scene.lines} scale={20} style={{ position: "absolute", left: 380, top: 580 }} />
        <Desk />
        <div
          style={{
            position: "absolute",
            left: 120,
            top: 190,
            zIndex: 1,
            padding: "8px 28px",
            background: colors.yellow,
            border: `8px solid ${colors.ink}`,
            fontFamily: bodyFont,
            fontWeight: 900,
            fontSize: 52,
            color: colors.ink,
            transform: `scale(${tag}) rotate(-3deg)`,
          }}
        >
          {scene.tag}
        </div>
        <Card style={{ left: 110, top: 225, width: 860, height: 290, borderColor: colors.red, transform: `scale(${interpolate(stamp, [0, 1], [2.4, 1])}) rotate(-4deg)`, opacity: stamp > 0.01 ? 1 : 0 }}>
          <div style={{ fontSize: 80, lineHeight: 1.1 }}>{scene.bigLabel}</div>
          <div style={{ fontSize: 170, lineHeight: 1, color: colors.red, whiteSpace: "nowrap" }}>{scene.big}</div>
        </Card>
      </div>
      <Sfx at={stampAt} name="stamp" volume={0.8} />
    </PushIn>
  );
};

const CountUp: React.FC<{ from: number; to: number; start: number; frames: number; prefix?: string; color: string; size: number }> = ({ from, to, start, frames, prefix = "", color, size }) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [start, start + frames], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const done = frame >= start + frames;
  const pulse = done ? 1 + 0.12 * Math.max(0, 1 - (frame - start - frames) / 8) : 1;
  return <div style={{ fontSize: size, color, lineHeight: 1.1, transform: `scale(${pulse})` }}>{prefix}{yen(value)}</div>;
};

const CounterScene: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const [yearLine, mealLine] = scene.lines;
  const showMeal = frame >= mealLine.start - 4;
  const flip = usePop(mealLine.start - 4, 14);
  const enter = usePop(yearLine.start - 8, 12);
  const yearCountStart = yearLine.start + 6;
  const mealCountStart = mealLine.start + 18;
  return (
    <PushIn duration={scene.duration}>
      <Studio dim={0.55} />
      <AnchorSmall scene={scene} />
      <Desk />
      <Card style={{ left: 140, top: 230, width: 800, height: 520, transform: showMeal ? `scaleX(${flip})` : `scale(${enter})` }}>
        {!showMeal ? (
          <>
            <div style={{ fontSize: 56 }}>1年で</div>
            <CountUp from={500} to={5500} start={yearCountStart} frames={36} color={colors.blue} size={150} />
            <div style={{ fontSize: 40, color: "#666", marginTop: 10 }}>月500円 × 11か月</div>
          </>
        ) : (
          <>
            <svg width={160} height={80} viewBox="0 0 16 8" shapeRendering="crispEdges">
              <rect x={1} y={4} width={14} height={2} fill="#ddd" />
              <rect x={3} y={6} width={10} height={1} fill="#bbb" />
              <rect x={4} y={1} width={8} height={3} fill={colors.orange} />
              <rect x={6} y={0} width={4} height={1} fill={colors.green} />
            </svg>
            <div style={{ fontSize: 56, marginTop: 10 }}>給食1食あたり</div>
            <CountUp from={0} to={25} start={mealCountStart} frames={24} prefix="約" color={colors.red} size={170} />
          </>
        )}
      </Card>
      <Sfx at={yearCountStart + 36} name="ding" volume={0.45} />
      <Sfx at={mealLine.start - 4} name="whoosh" volume={0.35} />
      <Sfx at={mealCountStart + 24} name="ding" volume={0.45} />
    </PushIn>
  );
};

const FamilyScene: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [totalLine, aidLine] = scene.lines;
  const kids = scene.kids ?? 2;
  const perKid = scene.perKid ?? 5500;
  const firstKidAt = totalLine.start + 4;
  const totalStart = atWord(totalLine, "年", fps, 1.2);
  const aid = spring({ frame: frame - aidLine.start + 4, fps, config: { damping: 14 } });
  return (
    <PushIn duration={scene.duration}>
      <Studio dim={0.55} />
      <AnchorSmall scene={scene} />
      <Desk />
      {Array.from({ length: kids }, (_, i) => {
        const at = firstKidAt + i * 10;
        const pop = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 220 } });
        const left = 540 - (kids * 260) / 2 + i * 260 + 50;
        return (
          <div key={i} style={{ position: "absolute", left, top: 220, transform: `scale(${pop})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PixelSprite sprite={KID} scale={10} blink={(frame + i * 40) % 96 < 4} />
            <div style={{ marginTop: 10, fontFamily: bodyFont, fontWeight: 900, fontSize: 34, background: colors.yellow, border: `5px solid ${colors.ink}`, borderRadius: 12, padding: "2px 12px", color: colors.ink }}>
              +{yen(perKid)}/年
            </div>
            <Sfx at={at} name="pop" volume={0.4} />
          </div>
        );
      })}
      <Card style={{ left: 190, top: 560, width: 700, height: 200, transform: `scale(${usePop(totalStart - 6, 12)})` }}>
        <CountUp from={0} to={kids * perKid} start={totalStart} frames={30} prefix="年 " color={colors.red} size={110} />
      </Card>
      <Sfx at={totalStart + 30} name="ding" volume={0.45} />
      <Card
        style={{
          left: 120,
          top: 520,
          width: 840,
          height: 280,
          borderColor: colors.green,
          transform: `translateY(${interpolate(aid, [0, 1], [700, 0])}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width={100} height={100} viewBox="0 0 10 10" shapeRendering="crispEdges">
            <rect x={0} y={0} width={10} height={10} fill={colors.green} />
            <rect x={2} y={5} width={2} height={2} fill={colors.white} />
            <rect x={4} y={6} width={2} height={2} fill={colors.white} />
            <rect x={6} y={2} width={2} height={5} fill={colors.white} />
          </svg>
          <div style={{ fontSize: 70 }}>就学援助で補助あり</div>
        </div>
        <div style={{ fontSize: 40, color: "#666", marginTop: 16 }}>※収入の条件があります</div>
      </Card>
      <Sfx at={aidLine.start - 4} name="whoosh" volume={0.35} />
    </PushIn>
  );
};

const SummaryScene: React.FC<{ scene: TimedScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [pointsLine, kidLine] = scene.lines;
  const points = scene.points ?? [];
  const needles = ["4月", "500", "補助"];
  const title = usePop(pointsLine.start - 6, 12);
  const kidPop = spring({ frame: frame - kidLine.start + 6, fps, config: { damping: 7, stiffness: 160 } });
  const jump = frame >= kidLine.start ? -Math.abs(Math.sin((frame - kidLine.start) / 4)) * 40 : 0;
  return (
    <PushIn duration={scene.duration}>
      <Studio dim={0.4} />
      <AnchorSmall scene={scene} />
      <Desk />
      <div style={{ position: "absolute", top: 210, width: "100%", textAlign: "center", fontFamily: pixelFont, fontSize: 88, color: colors.yellow, textShadow: outline(colors.ink, 6), transform: `scale(${title})` }}>
        ポイントは3つ
      </div>
      {points.map((p, i) => {
        const at = atWord(pointsLine, needles[i] ?? p, fps, 1.4 + i * 1.1) - 4;
        const pop = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 200 } });
        return (
          <div
            key={p}
            style={{
              position: "absolute",
              left: 190,
              top: 350 + i * 150,
              width: 580,
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
              fontSize: 60,
              color: colors.ink,
              transform: `translateX(${interpolate(pop, [0, 1], [900, 0])}px)`,
            }}
          >
            <div style={{ width: 76, height: 76, borderRadius: 38, background: colors.red, color: colors.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>{i + 1}</div>
            {p}
            <Sfx at={at} name="pop" volume={0.4} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 840, top: 640, transform: `scale(${kidPop}) translateY(${jump}px)` }}>
        <Character sprite={KID} lines={[kidLine]} scale={11} blinkOffset={20} />
        <div style={{ position: "absolute", left: -50, top: -70, fontFamily: pixelFont, fontSize: 110, color: colors.yellow, textShadow: outline(colors.ink, 6) }}>！</div>
      </div>
    </PushIn>
  );
};

export const SceneView: React.FC<{ scene: TimedScene; index: number }> = ({ scene, index }) => {
  const body = (() => {
    switch (scene.type) {
      case "coldOpen":
        return <ColdOpen scene={scene} />;
      case "hook":
        return <Hook scene={scene} />;
      case "counter":
        return <CounterScene scene={scene} />;
      case "family":
        return <FamilyScene scene={scene} />;
      case "summary":
        return <SummaryScene scene={scene} />;
    }
  })();
  return (
    <AbsoluteFill>
      {body}
      {index > 0 && <Sfx at={0} name="whoosh" volume={0.4} />}
    </AbsoluteFill>
  );
};
