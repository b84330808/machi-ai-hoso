/**
 * Edit plan for the submission video, computed from the recorder's logs (demo/record.mjs) and the narration
 * lengths, so a re-recording re-cuts itself: each part lasts as long as its narration needs, and long waits in
 * the newsroom are sped up instead of cut.
 */
import type { Timeline } from "../timeline";

export const FPS = 30;

export type Rect = { x: number; y: number; w: number; h: number };
export type ClipEvent = {
  t: number;
  type: "click" | "mark" | "play" | "stop";
  x?: number;
  y?: number;
  label?: string;
  mark?: string;
  rect?: Rect;
  episodeId?: string;
  fromLine?: number;
};
export type ClipLog = { duration: number; events: ClipEvent[] };
export type NarrationLine = { id: string; file: string; duration: number; text: string };

/** A stretch of one recording: clip seconds [from, to) shown at `speed`, or frozen on `from` when `hold`. */
export type Shot = { clip: string; from: number; to: number; speed: number; hold: boolean; start: number; dur: number; zoom: number; chip?: string };
export type NarrationCue = { id: string; start: number; dur: number; text: string; file: string };
/** An episode drawn over the phone frame of a recording, with sound: demo seconds, episode frame at its start. */
export type EpisodeCue = { shot: number; start: number; dur: number; episodeId: string; episodeFrom: number; rect: Rect; volume: number };
export type ClickCue = { shot: number; move: number; click: number; x: number; y: number; fromX: number; fromY: number };

export type Plan = {
  hook: { episodeId: string; dur: number };
  shots: Shot[];
  narration: NarrationCue[];
  episodes: EpisodeCue[];
  clicks: ClickCue[];
  outro: { start: number; dur: number };
  total: number;
};

const HOOK = 10;
const OUTRO = 6.5;
const MAX_SPEED = 12;
const MOVE = 0.45; // the recorder waits this long between logging a click and clicking
const DUCKED = 0.22;

/** Newsroom steps between the recorder's marks, each with the narration and the Claude feature it shows. */
const SECTIONS: { from: string; to: string; narration?: string; chip: string; zoom: number }[] = [
  { from: "go", to: "desk", chip: "Claude が町の資料を読んでいます", zoom: 1 },
  { from: "desk", to: "facts", narration: "desk", chip: "Claude ｜ 構造化出力でネタを採点", zoom: 1.28 },
  { from: "facts", to: "writer", narration: "facts", chip: "Claude ｜ Citations API で原文のページを引用", zoom: 1.28 },
  { from: "writer", to: "check", narration: "writer", chip: "Claude ｜ ストリーミングで台本を執筆", zoom: 1.28 },
  { from: "check", to: "voice", narration: "check", chip: "コードで数値を照合 ＋ Claude が校閲", zoom: 1.28 },
  { from: "voice", to: "done", narration: "voice", chip: "音声合成でナレーションを収録", zoom: 1 },
];

export const buildPlan = (clips: Record<string, ClipLog>, voices: Record<string, NarrationLine>, timelines: Record<string, Timeline>): Plan => {
  const shots: Shot[] = [];
  const narration: NarrationCue[] = [];
  let now = HOOK;

  const say = (id: string, at: number) => {
    const v = voices[id];
    narration.push({ id, start: at, dur: v.duration, text: v.text, file: v.file });
  };
  const add = (shot: Omit<Shot, "start">) => {
    shots.push({ ...shot, start: now });
    now += shot.dur;
  };
  /** Plays [from, to) at 1x, first holding the opening frame if the narration needs more time than that. */
  const realtime = (clip: string, from: number, to: number, atLeast: number, extra: Partial<Shot> = {}) => {
    const hold = atLeast - (to - from);
    if (hold > 0) add({ clip, from, to: from, speed: 1, hold: true, dur: hold, zoom: 1, ...extra });
    add({ clip, from, to, speed: 1, hold: false, dur: to - from, zoom: 1, ...extra });
  };
  const ev = (clip: string, pred: (e: ClipEvent) => boolean) => clips[clip].events.find(pred);

  // 1. The town's website and the PDF, sped up to fit the narration.
  {
    const site = clips.site;
    const dur = Math.max(voices.problem.duration + 1.4, site.duration / 1.8);
    say("problem", now + 0.4);
    add({ clip: "site", from: 0, to: site.duration, speed: site.duration / dur, hold: false, dur, zoom: 1 });
  }

  // 2. Picking the town and pressing the button, in real time.
  const goClick = ev("make", (e) => e.type === "click" && e.label === "取材をはじめる");
  if (!goClick) throw new Error("make: no click on 取材をはじめる");
  const marks: Record<string, number> = { go: goClick.t + MOVE + 0.8 };
  for (const e of clips.make.events) if (e.type === "mark" && e.mark && marks[e.mark] === undefined) marks[e.mark] = e.t;
  say("intro", now + 0.2);
  realtime("make", 0, marks.go, voices.intro.duration + 0.6);

  // 3. The newsroom at work: each step lasts as long as its narration, the waiting in between is sped up.
  const points = SECTIONS.filter((s) => marks[s.from] !== undefined && marks[s.to] !== undefined);
  for (const s of points) {
    const real = marks[s.to] - marks[s.from];
    const want = s.narration ? voices[s.narration].duration + 0.9 : 2.2;
    if (s.narration) say(s.narration, now + 0.3);
    const dur = Math.max(want, real / MAX_SPEED);
    if (dur >= real) {
      add({ clip: "make", from: marks[s.from], to: marks[s.to], speed: 1, hold: false, dur: real, zoom: s.zoom, chip: s.chip });
      add({ clip: "make", from: marks[s.to], to: marks[s.to], speed: 1, hold: true, dur: dur - real, zoom: s.zoom, chip: s.chip });
    } else {
      add({ clip: "make", from: marks[s.from], to: marks[s.to], speed: real / dur, hold: false, dur, zoom: s.zoom, chip: s.chip });
    }
  }
  add({ clip: "make", from: marks.done, to: marks.done + 1.2, speed: 1, hold: false, dur: 1.2, zoom: 1 });

  // 4. The finished episode, a jump to one line, and the cited PDF page.
  {
    const r = clips.result;
    const lineClick = ev("result", (e) => e.type === "click" && e.label === "line 4");
    const sourceClick = ev("result", (e) => e.type === "click" && e.label === "出典");
    if (!lineClick || !sourceClick) throw new Error("result: missing clicks");
    const firstPlay = ev("result", (e) => e.type === "play")!;
    add({ clip: "result", from: 0, to: firstPlay.t + 7, speed: 1, hold: false, dur: firstPlay.t + 7, zoom: 1 });
    say("result", now + 0.2);
    realtime("result", lineClick.t - 1.2, sourceClick.t, voices.result.duration + 0.5);
    say("source", now + 0.6);
    // Show the click, then cut past the PDF loading on page 1 to the cited page.
    add({ clip: "result", from: sourceClick.t, to: sourceClick.t + MOVE + 0.3, speed: 1, hold: false, dur: MOVE + 0.3, zoom: 1 });
    const page = sourceClick.t + 4;
    realtime("result", page, Math.min(r.duration, page + voices.source.duration + 1.5), voices.source.duration + 0.8);
  }

  // 5. Other audiences and 6. other towns, in real time.
  say("audiences", now + 0.3);
  realtime("audiences", 0, clips.audiences.duration, voices.audiences.duration + 1);
  say("towns", now + 0.3);
  realtime("towns", 0, clips.towns.duration, voices.towns.duration + 1);

  const outro = { start: now, dur: OUTRO };
  say("outro", now + 0.5);
  now += OUTRO;

  // Episodes over the phone frame, wherever a recording plays one in real time. Not in the newsroom run: it only
  // shows the player starting, and its sound there would cut off a moment later.
  const episodes: EpisodeCue[] = [];
  shots.forEach((shot, index) => {
    if (shot.hold || shot.speed !== 1 || shot.clip === "make") return;
    const events = clips[shot.clip].events;
    let current: { t: number; episodeId: string; frame: number; rect: Rect } | undefined;
    const intervals: { from: number; to: number; episodeId: string; frame: number; rect: Rect }[] = [];
    for (const e of events) {
      if (e.type === "play") {
        const episodeId = e.episodeId ?? current?.episodeId;
        if (!episodeId || !timelines[episodeId] || !e.rect) continue;
        if (current) intervals.push({ from: current.t, to: e.t, episodeId: current.episodeId, frame: current.frame, rect: current.rect });
        const line = timelines[episodeId].lines[e.fromLine ?? 0];
        current = { t: e.t, episodeId, frame: e.fromLine ? line.globalStart : 0, rect: e.rect };
      }
      if (e.type === "stop" && current) {
        intervals.push({ from: current.t, to: e.t, episodeId: current.episodeId, frame: current.frame, rect: current.rect });
        current = undefined;
      }
    }
    if (current) intervals.push({ from: current.t, to: Infinity, episodeId: current.episodeId, frame: current.frame, rect: current.rect });
    for (const iv of intervals) {
      const a = Math.max(iv.from, shot.from);
      const b = Math.min(iv.to, shot.to, iv.from + timelines[iv.episodeId].total / FPS);
      if (b - a < 0.1) continue;
      episodes.push({ shot: index, start: shot.start + (a - shot.from), dur: b - a, episodeId: iv.episodeId, episodeFrom: iv.frame + Math.round((a - iv.from) * FPS), rect: iv.rect, volume: 1 });
    }
  });

  // Lower an episode's sound while the narrator talks over it, by splitting its cue at narration edges.
  const ducked: EpisodeCue[] = [];
  for (const cue of episodes) {
    const edges = [cue.start, cue.start + cue.dur];
    for (const n of narration) for (const t of [n.start, n.start + n.dur]) if (t > cue.start && t < cue.start + cue.dur) edges.push(t);
    edges.sort((x, y) => x - y);
    for (let i = 0; i < edges.length - 1; i++) {
      const s = edges[i];
      const e = edges[i + 1];
      if (e - s < 1 / FPS) continue;
      const talking = narration.some((n) => n.start < e && n.start + n.dur > s);
      ducked.push({ ...cue, start: s, dur: e - s, episodeFrom: cue.episodeFrom + Math.round((s - cue.start) * FPS), volume: talking ? DUCKED : 1 });
    }
  }

  // The drawn cursor: it travels to each click, then fades out.
  const clicks: ClickCue[] = [];
  shots.forEach((shot, index) => {
    if (shot.hold) return;
    let last = { x: 1500, y: 900 };
    for (const e of clips[shot.clip].events) {
      if (e.type !== "click" || e.x === undefined || e.y === undefined) continue;
      if (e.t >= shot.from - 0.1 && e.t + MOVE <= shot.to) {
        const toDemo = (t: number) => shot.start + (t - shot.from) / shot.speed;
        clicks.push({ shot: index, move: toDemo(e.t), click: toDemo(e.t + MOVE), x: e.x, y: e.y, fromX: last.x, fromY: last.y });
      }
      last = { x: e.x, y: e.y };
    }
  });

  const hookEpisode = ev("result", (e) => e.type === "play" && !!e.episodeId)?.episodeId;
  if (!hookEpisode) throw new Error("result: no episode played");
  return { hook: { episodeId: hookEpisode, dur: HOOK }, shots, narration, episodes: ducked, clicks, outro, total: now };
};
