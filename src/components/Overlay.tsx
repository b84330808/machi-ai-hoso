import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTimeline } from "../context";
import type { TimedLine } from "../timeline";
import { bodyFont, colors, layout, outline, pixelFont } from "../theme";

const SPEAKER_NAMES = { anchor: "マチコ（AIアナ）", kid: "ソウタ" } as const;

/** The line being spoken, or the last one until the next starts. */
const useCurrentLine = (): TimedLine | undefined => {
  const frame = useCurrentFrame();
  const { lines } = useTimeline();
  return [...lines].reverse().find((l) => frame >= l.globalStart);
};

/** Fixed lower panel behind telops so the stage can slide independently. */
export const LowerPanel: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: layout.stageBottom,
      width: layout.width,
      height: layout.height - layout.stageBottom,
      background: `repeating-linear-gradient(0deg, ${colors.panel} 0 12px, #181834 12px 24px)`,
      borderTop: `10px solid ${colors.yellow}`,
    }}
  />
);

export const Header: React.FC = () => {
  const frame = useCurrentFrame();
  const { meta, total } = useTimeline();
  const progress = Math.min(1, frame / total);
  const [, month, day] = meta.date.split("-").map(Number);
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          height: layout.headerHeight,
          background: colors.ink,
          display: "flex",
          alignItems: "center",
          padding: "0 44px",
          gap: 20,
        }}
      >
        {/* Pixel antenna icon */}
        <svg width={64} height={64} viewBox="0 0 8 8" shapeRendering="crispEdges">
          <rect x={3} y={3} width={2} height={5} fill={colors.yellow} />
          <rect x={1} y={0} width={1} height={3} fill={colors.red} />
          <rect x={6} y={0} width={1} height={3} fill={colors.red} />
          <rect x={2} y={2} width={4} height={1} fill={colors.red} />
        </svg>
        <div style={{ fontFamily: pixelFont, fontSize: 58, color: colors.white, flex: 1, letterSpacing: 2 }}>まちのAI放送局</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: bodyFont, fontWeight: 900, fontSize: 30, color: colors.white, background: colors.red, padding: "4px 16px", borderRadius: 8 }}>
            AI生成
          </div>
          <div style={{ fontFamily: pixelFont, fontSize: 30, color: colors.sky, marginTop: 6 }}>
            {month}/{day} {meta.city}
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: layout.headerHeight, left: 0, width: layout.width, height: 10, background: "#2a2a4a" }}>
        <div style={{ width: `${progress * 100}%`, height: "100%", background: colors.yellow }} />
      </div>
    </>
  );
};

const renderWithEmphasis = (text: string, emphasis: string[], visibleChars: number) => {
  const marks = new Array<boolean>(text.length).fill(false);
  for (const word of emphasis) {
    const at = text.indexOf(word);
    if (at >= 0) for (let i = at; i < at + word.length; i++) marks[i] = true;
  }
  return text.split("").map((ch, i) => (
    <span
      key={i}
      style={{
        color: marks[i] ? colors.yellow : colors.white,
        fontSize: marks[i] ? "1.12em" : "1em",
        opacity: i < visibleChars ? 1 : 0,
      }}
    >
      {ch}
    </span>
  ));
};

const TelopLine: React.FC<{ line: TimedLine }> = ({ line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - line.globalStart;
  const t = local / fps;
  const first = line.words[0]?.start ?? 0;
  const last = line.words.at(-1)?.end ?? line.frames / fps;
  const progress = interpolate(t, [first, first + (last - first) * 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const display = line.telop ?? line.text;
  const visible = Math.max(1, Math.ceil(progress * display.length));
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 180 } });
  const isKid = line.speaker === "kid";

  return (
    <div style={{ position: "absolute", top: layout.telopTop, left: 60, width: 960 }}>
      <div
        style={{
          display: "inline-block",
          fontFamily: bodyFont,
          fontWeight: 900,
          fontSize: 34,
          color: colors.ink,
          background: isKid ? colors.orange : colors.sky,
          padding: "4px 18px",
          borderRadius: 10,
          marginBottom: 18,
          transform: `scale(${pop})`,
          transformOrigin: "left center",
        }}
      >
        {SPEAKER_NAMES[line.speaker]}
      </div>
      <div
        style={{
          fontFamily: bodyFont,
          fontWeight: 900,
          fontSize: 78,
          lineHeight: 1.3,
          whiteSpace: "pre-line",
          textShadow: outline(colors.ink, 8),
          transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
          transformOrigin: "left top",
        }}
      >
        {renderWithEmphasis(display, line.emphasis ?? [], visible)}
      </div>
    </div>
  );
};

export const Telop: React.FC = () => {
  const current = useCurrentLine();
  if (!current) return null;
  return <TelopLine key={current.id} line={current} />;
};

/** News crawl across the front of the desk. */
export const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const { meta } = useTimeline();
  const text = `▶ ${meta.city}のニュースを毎週3分で　／　内容はすべて公開資料から作成　／　今日のニュース：${meta.title}　`;
  const itemWidth = text.length * 40;
  const x = -((frame * 5) % itemWidth);
  return (
    <div style={{ position: "absolute", left: 0, top: 1040, width: layout.width, height: 70, overflow: "hidden", background: colors.yellow, borderTop: `6px solid ${colors.ink}` }}>
      <div style={{ position: "absolute", left: x, top: 8, whiteSpace: "nowrap", fontFamily: bodyFont, fontWeight: 900, fontSize: 38, color: colors.ink }}>
        <span style={{ display: "inline-block", width: itemWidth }}>{text}</span>
        <span style={{ display: "inline-block", width: itemWidth }}>{text}</span>
      </div>
    </div>
  );
};

/** Citation for the line on screen; falls back to the episode's main source. */
export const SourceBar: React.FC = () => {
  const { meta } = useTimeline();
  const current = useCurrentLine();
  return (
    <div
      style={{
        position: "absolute",
        top: layout.sourceTop,
        left: 60,
        right: 60,
        display: "flex",
        alignItems: "center",
        gap: 16,
        fontFamily: bodyFont,
        fontWeight: 700,
        fontSize: 30,
        color: "#c9cbe8",
      }}
    >
      <svg width={36} height={44} viewBox="0 0 9 11" shapeRendering="crispEdges" style={{ flexShrink: 0 }}>
        <rect x={0} y={0} width={9} height={11} fill="#c9cbe8" />
        <rect x={2} y={3} width={5} height={1} fill={colors.panel} />
        <rect x={2} y={5} width={5} height={1} fill={colors.panel} />
        <rect x={2} y={7} width={3} height={1} fill={colors.panel} />
      </svg>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>出典：{current?.sourceRef ?? meta.source}</span>
      {meta.sourceNote && (
        <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 24, color: colors.ink, background: "#c9cbe8", padding: "2px 12px", borderRadius: 6 }}>{meta.sourceNote}</span>
      )}
    </div>
  );
};

export const OverlayRoot: React.FC = () => (
  <AbsoluteFill>
    <Ticker />
    <LowerPanel />
    <Header />
    <Telop />
    <SourceBar />
  </AbsoluteFill>
);
