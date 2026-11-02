import React from "react";
import { AbsoluteFill, random } from "remotion";
import { colors, layout, pixelFont } from "../theme";

/** Night-time dining room for the cold open. */
export const Kitchen: React.FC = () => {
  const stars = Array.from({ length: 14 }, (_, i) => ({
    x: 40 + random(`star-x-${i}`) * 300,
    y: 30 + random(`star-y-${i}`) * 200,
  }));
  return (
    <AbsoluteFill style={{ height: layout.stageBottom }}>
      <AbsoluteFill
        style={{
          background: `repeating-linear-gradient(90deg, #f6e3c6 0 40px, #f1d9b5 40px 80px)`,
        }}
      />
      {/* Window */}
      <div style={{ position: "absolute", left: 70, top: 230, width: 380, height: 300, background: "#24305e", border: "16px solid #8a5a3b" }}>
        {stars.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: 8, height: 8, background: colors.yellow }} />
        ))}
        <div style={{ position: "absolute", left: 250, top: 40, width: 60, height: 60, background: "#fff3b0", boxShadow: "0 0 0 8px #24305e" }} />
        <div style={{ position: "absolute", left: 174, top: 0, width: 16, height: 300, background: "#8a5a3b" }} />
      </div>
      {/* Pendant lamp */}
      <div style={{ position: "absolute", left: 640, top: 150, width: 8, height: 90, background: colors.ink }} />
      <div style={{ position: "absolute", left: 580, top: 240, width: 128, height: 48, background: colors.orange, borderBottom: "8px solid #c75f1f" }} />
    </AbsoluteFill>
  );
};

/** News studio with a pixel skyline of the town behind the desk. */
export const Studio: React.FC<{ dim?: number }> = ({ dim = 0 }) => {
  const buildings = Array.from({ length: 12 }, (_, i) => {
    const w = 70 + Math.floor(random(`bw-${i}`) * 60);
    const h = 160 + Math.floor(random(`bh-${i}`) * 300);
    return { w, h };
  });
  let x = -20;
  return (
    <AbsoluteFill style={{ height: layout.stageBottom, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.blue} 0%, ${colors.sky} 70%, #c9e0ff 100%)` }} />
      {buildings.map((b, i) => {
        const left = x;
        x += b.w + 6;
        const windows = Array.from({ length: Math.floor(b.h / 50) }, (_, r) => r);
        return (
          <div key={i} style={{ position: "absolute", left, bottom: layout.stageBottom - 860, width: b.w, height: b.h, background: i % 2 ? "#3a4f8f" : "#30427a" }}>
            {windows.map((r) =>
              [0, 1].map((c) => (
                <div
                  key={`${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: 14 + c * (b.w / 2 - 6),
                    top: 18 + r * 50,
                    width: 18,
                    height: 22,
                    background: random(`win-${i}-${r}-${c}`) > 0.45 ? colors.yellow : "#25356a",
                  }}
                />
              )),
            )}
          </div>
        );
      })}
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(20,20,43,${dim})` }} />}
    </AbsoluteFill>
  );
};

/** Desk drawn in front of the anchor. */
export const Desk: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: 0, top: 860, width: 1080, height: 24, background: colors.yellow }} />
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 884,
        width: 1080,
        height: layout.stageBottom - 884,
        background: colors.ink,
        display: "flex",
        justifyContent: "center",
        paddingTop: 34,
        boxSizing: "border-box",
        fontFamily: pixelFont,
        fontSize: 48,
        color: colors.yellow,
        letterSpacing: 6,
      }}
    >
      NEWS
    </div>
  </>
);

/** Front edge of the dining table, drawn over the kid's legs. */
export const TableFront: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: 0, top: 900, width: 1080, height: 40, background: "#a8704a" }} />
    <div style={{ position: "absolute", left: 0, top: 940, width: 1080, height: layout.stageBottom - 940, background: "#8a5a3b" }} />
    <div style={{ position: "absolute", left: 140, top: 880, width: 160, height: 24, background: colors.white, borderRadius: 4 }} />
    <div style={{ position: "absolute", left: 780, top: 880, width: 160, height: 24, background: colors.white, borderRadius: 4 }} />
  </>
);
