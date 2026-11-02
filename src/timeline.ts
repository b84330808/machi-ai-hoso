import type { Episode, Line, Scene } from "./schema";

export const FPS = 30;
export const TRANSITION = 12;
const LEAD = TRANSITION + 6; // narration starts after the transition has settled
const GAP = 9;
const TAIL = 18;

export type Word = { text: string; start: number; end: number };
export type ManifestEntry = { id: string; file: string; duration: number; words: Word[] };
export type Manifest = Record<string, ManifestEntry>;

export type TimedLine = Line & {
  /** Frame offset inside its scene. */
  start: number;
  /** Frame offset inside the whole episode. */
  globalStart: number;
  frames: number;
  file: string;
  words: Word[];
};

export type TimedScene = Omit<Scene, "lines"> & {
  lines: TimedLine[];
  duration: number;
  globalStart: number;
};

export type Timeline = {
  meta: Omit<Episode, "scenes">;
  scenes: TimedScene[];
  lines: TimedLine[];
  total: number;
};

export const buildTimeline = (episode: Episode, manifest: Manifest): Timeline => {
  const { scenes: rawScenes, ...meta } = episode;
  let globalStart = 0;
  const scenes = rawScenes.map((scene) => {
    let cursor = LEAD;
    const lines = scene.lines.map((line) => {
      const audio = manifest[line.id];
      if (!audio) throw new Error(`No TTS audio for ${line.id}. Run \`npm run tts\`.`);
      const frames = Math.ceil(audio.duration * FPS);
      const timed: TimedLine = { ...line, start: cursor, globalStart: globalStart + cursor, frames, file: audio.file, words: audio.words };
      cursor += frames + GAP;
      return timed;
    });
    const timedScene: TimedScene = { ...scene, lines, duration: cursor + TAIL, globalStart };
    globalStart += timedScene.duration - TRANSITION;
    return timedScene;
  });
  return { meta, scenes, lines: scenes.flatMap((s) => s.lines), total: globalStart + TRANSITION };
};

/** Frame inside the scene at which a word of the line is spoken, or undefined. */
export const wordFrame = (line: TimedLine, needle: string | undefined, fps: number): number | undefined => {
  if (!needle) return undefined;
  const word = line.words.find((w) => w.text.includes(needle) || needle.includes(w.text));
  return word ? line.start + Math.round(word.start * fps) : undefined;
};
