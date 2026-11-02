import React from "react";
import { colors } from "../theme";

export type IconName = "meal" | "yen" | "calendar" | "house" | "bus" | "trash" | "school" | "check" | "warning" | "info";

// 10x10 grids; each letter maps to a colour below.
const ICONS: Record<IconName, string[]> = {
  meal: ["..........", "....GG....", "...OOOO...", "..OOOOOO..", "..OOOOOO..", "LLLLLLLLLL", ".LLLLLLLL.", "..DDDDDD..", "..........", ".........."],
  yen: ["..YYYYYY..", ".YYYYYYYY.", "YYKYYYYKYY", "YYYKYYKYYY", "YYKKKKKKYY", "YYYYKKYYYY", "YYKKKKKKYY", ".YYYKKYYY.", "..YYYYYY..", ".........."],
  calendar: ["..K....K..", "RRRRRRRRRR", "RRRRRRRRRR", "WWWWWWWWWW", "WKWWKWWKWW", "WWWWWWWWWW", "WKWWKWWKWW", "WWWWWWWWWW", "WWWWWWWWWW", ".........."],
  house: ["....RR....", "...RRRR...", "..RRRRRR..", ".RRRRRRRR.", "..WWWWWW..", "..WBBWDW..", "..WBBWDW..", "..WWWWDW..", "GGGGGGGGGG", ".........."],
  bus: [".YYYYYYYY.", "YYYYYYYYYY", "YBBYBBYBBY", "YBBYBBYBBY", "YYYYYYYYYY", "YYYYYYYYYY", "YYYYYYYYYY", ".KK....KK.", ".KK....KK.", ".........."],
  trash: ["...KKKK...", ".KKKKKKKK.", "..GGGGGG..", "..GWGGWG..", "..GWGGWG..", "..GWGGWG..", "..GWGGWG..", "..GGGGGG..", "...GGGG...", ".........."],
  school: ["....RR....", "...RRRR...", "WWWWWWWWWW", "WBBWBBWBBW", "WWWWWWWWWW", "WBBWDDWBBW", "WWWWDDWWWW", "WWWWDDWWWW", "GGGGGGGGGG", ".........."],
  check: ["GGGGGGGGGG", "GGGGGGGGWG", "GGGGGGGWWG", "GGGGGGWWGG", "GWGGGWWGGG", "GWWGWWGGGG", "GGWWWGGGGG", "GGGWGGGGGG", "GGGGGGGGGG", ".........."],
  warning: ["....YY....", "...YYYY...", "...YKKY...", "..YYKKYY..", "..YYKKYY..", ".YYYKKYYY.", ".YYYYYYYY.", "YYYYKKYYYY", "YYYYYYYYYY", ".........."],
  info: ["..BBBBBB..", ".BBBWWBBB.", "BBBBBBBBBB", "BBBWWWBBBB", "BBBBWWBBBB", "BBBBWWBBBB", "BBBBWWBBBB", ".BBWWWWBB.", "..BBBBBB..", ".........."],
};

const PALETTE: Record<string, string> = {
  K: colors.ink,
  W: colors.white,
  R: colors.red,
  Y: colors.yellow,
  G: colors.green,
  B: colors.blue,
  O: colors.orange,
  L: "#dddddd",
  D: "#8a5a3b",
};

export const PixelIcon: React.FC<{ name: IconName; size: number }> = ({ name, size }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges">
    {ICONS[name].flatMap((row, y) =>
      row.split("").map((key, x) => (PALETTE[key] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[key]} /> : null)),
    )}
  </svg>
);
