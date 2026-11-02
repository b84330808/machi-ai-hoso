import React from "react";

export type Mouth = "closed" | "half" | "open";

export type SpriteDef = {
  palette: Record<string, string>;
  rows: string[];
  mouth: { x: number; y: number };
  eyes: Array<{ x: number; y: number }>;
};

// Overlays relative to the mouth anchor: [dx, dy, paletteKey]
const MOUTHS: Record<Mouth, Array<[number, number, string]>> = {
  closed: [[0, 0, "M"], [1, 0, "M"]],
  half: [[0, 0, "M"], [1, 0, "M"], [0, 1, "R"], [1, 1, "R"]],
  open: [
    [-1, 0, "M"], [0, 0, "M"], [1, 0, "M"], [2, 0, "M"],
    [-1, 1, "M"], [0, 1, "R"], [1, 1, "R"], [2, 1, "M"],
    [0, 2, "M"], [1, 2, "M"],
  ],
};

const basePalette = {
  K: "#2b2135",
  S: "#ffd9b8",
  W: "#ffffff",
  E: "#2b2135",
  R: "#e86a7a",
  M: "#7a2a3a",
};

export const ANCHOR: SpriteDef = {
  palette: { ...basePalette, H: "#5a3a2e", B: "#2f6fd6", T: "#ffffff", Y: "#ffd23f", G: "#9aa0a6" },
  rows: [
    "....KKKKKKKK....",
    "..KKHHHHHHHHKK..",
    ".KHHHHHHHHHHHHK.",
    ".KHHHHHHHHHHHHK.",
    "KHHHSSHHHHSSHHHK",
    "KHHSSSSSSSSSSHHK",
    "KHSSWESSSSWESSHK",
    "KHSSEESSSSEESSHK",
    "KHSRSSSSSSSSRSHK",
    "KHSSSSSSSSSSSSHK",
    ".KHSSSSSSSSSSHK.",
    "..KKSSSSSSSSKK..",
    "....KKSSSSKK....",
    "..KKBBTTTTBBKK..",
    ".KBBBBTYYTBBBBK.",
    "KBBBBBTYYTBBBBBK",
    "KBBBBBBYYBBBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KKKKKKKKKKKKKKKK",
  ],
  mouth: { x: 7, y: 9 },
  eyes: [{ x: 4, y: 6 }, { x: 10, y: 6 }],
};

export const KID: SpriteDef = {
  palette: { ...basePalette, C: "#e8505b", H: "#3b2a22", O: "#3dbe7a" },
  rows: [
    "....KKKKKKKK....",
    "..KKCCCCCCCCKK..",
    ".KCCCCCWWCCCCCK.",
    "KCCCCCCCCCCCCCCK",
    "KKKKKKKKKKKKKKKKKK",
    "KHSSSSSSSSSSSSHK",
    "KSSSWESSSSWESSSK",
    "KSSSEESSSSEESSSK",
    "KSRSSSSSSSSSSRSK",
    "KSSSSSSSSSSSSSSK",
    ".KSSSSSSSSSSSSK.",
    "..KKSSSSSSSSKK..",
    "....KKSSSSKK....",
    "..KKOOOOOOOOKK..",
    ".KOOOOOOOOOOOOK.",
    "KOOOOOOOOOOOOOOK",
    "KOOOOOOOOOOOOOOK",
    "KOOOOOOOOOOOOOOK",
    "KOOOOOOOOOOOOOOK",
    "KKKKKKKKKKKKKKKK",
  ],
  mouth: { x: 7, y: 9 },
  eyes: [{ x: 4, y: 6 }, { x: 10, y: 6 }],
};

export const PixelSprite: React.FC<{
  sprite: SpriteDef;
  scale: number;
  mouth?: Mouth;
  blink?: boolean;
  style?: React.CSSProperties;
}> = ({ sprite, scale, mouth = "closed", blink = false, style }) => {
  const width = 16;
  const grid = sprite.rows.map((row) => row.slice(0, width).padEnd(width, ".").split(""));
  const set = (x: number, y: number, key: string) => {
    if (grid[y] && x >= 0 && x < width) grid[y][x] = key;
  };

  for (const [dx, dy, key] of MOUTHS[mouth]) set(sprite.mouth.x + dx, sprite.mouth.y + dy, key);
  if (blink) {
    for (const eye of sprite.eyes) {
      set(eye.x, eye.y, "S");
      set(eye.x + 1, eye.y, "S");
      set(eye.x, eye.y + 1, "K");
      set(eye.x + 1, eye.y + 1, "K");
    }
  }

  // Merge horizontal runs of the same colour into one rect.
  const rects: React.ReactNode[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < width) {
      const key = row[x];
      let run = 1;
      while (x + run < width && row[x + run] === key) run++;
      const fill = sprite.palette[key];
      if (key !== "." && fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={fill} />);
      x += run;
    }
  });

  return (
    <svg
      width={width * scale}
      height={grid.length * scale}
      viewBox={`0 0 ${width} ${grid.length}`}
      shapeRendering="crispEdges"
      style={style}
    >
      {rects}
    </svg>
  );
};
