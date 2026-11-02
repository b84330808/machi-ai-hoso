import episodeJson from "../episodes/sample-kyushokuhi.json";
import manifestJson from "../public/audio/manifest.json";

export const FPS = 30;
export const TRANSITION = 12;
const LEAD = TRANSITION + 6; // narration starts after the transition has settled
const GAP = 9;
const TAIL = 18;

export type Speaker = "anchor" | "kid";

export type Word = { text: string; start: number; end: number };

export type Line = {
  id: string;
  speaker: Speaker;
  text: string;
  /** Reading fed to TTS when it differs from the text. */
  yomi?: string;
  /** On-screen version of the text with explicit line breaks (\n). */
  telop?: string;
  emphasis?: string[];
};

export type SceneData = {
  id: string;
  type: "coldOpen" | "hook" | "counter" | "family" | "summary";
  lines: Line[];
  bigLabel?: string;
  big?: string;
  tag?: string;
  kids?: number;
  perKid?: number;
  points?: string[];
};

export type TimedLine = Line & {
  /** Frame offset inside its scene. */
  start: number;
  /** Frame offset inside the whole episode. */
  globalStart: number;
  frames: number;
  file: string;
  words: Word[];
};

export type TimedScene = Omit<SceneData, "lines"> & {
  lines: TimedLine[];
  duration: number;
  globalStart: number;
};

type ManifestEntry = { id: string; file: string; duration: number; words: Word[] };

const episode = episodeJson as { title: string; city: string; date: string; source: string; sourceNote: string; scenes: SceneData[] };
const manifest = manifestJson as Record<string, ManifestEntry>;

export const meta = {
  title: episode.title,
  city: episode.city,
  date: episode.date,
  source: episode.source,
  sourceNote: episode.sourceNote,
};

const buildTimeline = (): { scenes: TimedScene[]; total: number } => {
  let globalStart = 0;
  const scenes = episode.scenes.map((scene) => {
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
  return { scenes, total: globalStart + TRANSITION };
};

export const timeline = buildTimeline();
export const allLines = timeline.scenes.flatMap((s) => s.lines);

/** Seconds into a line at which the given word (substring match) starts, or undefined. */
export const wordTime = (line: TimedLine, needle: string): number | undefined =>
  line.words.find((w) => w.text.includes(needle) || needle.includes(w.text))?.start;
