/**
 * The submission video (1920x1080): recordings of the real app, edited by src/demo/plan.ts.
 * Episodes are drawn over the app's phone frame from the same components, so they play smoothly and with sound.
 */
import React from "react";
import { AbsoluteFill, Audio, Easing, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadGothic } from "@remotion/google-fonts/BIZUDPGothic";
import { loadFont as loadMincho } from "@remotion/google-fonts/BIZUDPMincho";
import { Episode } from "../Episode";
import type { Timeline } from "../timeline";
import { ClickCue, EpisodeCue, FPS, NarrationCue, Plan, Rect, Shot } from "./plan";

const gothic = loadGothic("normal", { weights: ["400", "700"] }).fontFamily;
const mincho = loadMincho("normal", { weights: ["700"] }).fontFamily;

const PAPER = "#f3ede0";
const INK = "#1f1c17";
const SHU = "#c53d24";

export type DemoProps = { plan: Plan | null; timelines: Record<string, Timeline> };

const f = (seconds: number) => Math.round(seconds * FPS);

/** An episode playing inside a phone frame at `rect` (the app's .phone element, 9px border). */
const PhoneEpisode: React.FC<{ cue: EpisodeCue; timeline: Timeline }> = ({ cue, timeline }) => {
  const inner = { x: cue.rect.x + 9, y: cue.rect.y + 9, w: cue.rect.w - 18, h: cue.rect.h - 18 };
  return (
    <div style={{ position: "absolute", left: inner.x, top: inner.y, width: inner.w, height: inner.h, overflow: "hidden", borderRadius: 13 }}>
      <div style={{ width: 1080, height: 1920, transform: `scale(${inner.w / 1080})`, transformOrigin: "0 0" }}>
        <Sequence from={-cue.episodeFrom} layout="none">
          <Episode episodeId={cue.episodeId} timeline={timeline} volume={cue.volume} />
        </Sequence>
      </div>
    </div>
  );
};

const Cursor: React.FC<{ cue: ClickCue; shotStart: number }> = ({ cue, shotStart }) => {
  const frame = useCurrentFrame() / FPS + shotStart;
  const travel = interpolate(frame, [cue.move, cue.click], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const x = cue.fromX + (cue.x - cue.fromX) * travel;
  const y = cue.fromY + (cue.y - cue.fromY) * travel;
  const opacity = interpolate(frame, [cue.move - 0.15, cue.move, cue.click + 1.0, cue.click + 1.4], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ripple = interpolate(frame, [cue.click, cue.click + 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const press = frame >= cue.click && frame < cue.click + 0.12 ? 0.85 : 1;
  return (
    <>
      {frame >= cue.click && ripple < 1 && (
        <div style={{ position: "absolute", left: cue.x - 40 * ripple, top: cue.y - 40 * ripple, width: 80 * ripple, height: 80 * ripple, borderRadius: "50%", border: `4px solid ${SHU}`, opacity: 1 - ripple }} />
      )}
      <svg style={{ position: "absolute", left: x - 4, top: y - 2, opacity, transform: `scale(${press})`, transformOrigin: "4px 2px" }} width="34" height="44" viewBox="0 0 17 22">
        <path d="M1 1 L1 17 L5 13 L8 20 L11 19 L8 12 L14 12 Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
};

const ShotView: React.FC<{ shot: Shot; prevZoom: number; plan: Plan; index: number; timelines: Record<string, Timeline> }> = ({ shot, prevZoom, plan, index, timelines }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 14], [prevZoom, shot.zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const video = <OffthreadVideo src={staticFile(`demo/${shot.clip}.mp4`)} trimBefore={f(shot.from)} playbackRate={shot.hold ? 1 : shot.speed} muted />;
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "0% 72%" }}>
      {shot.hold ? <Freeze frame={0}>{video}</Freeze> : video}
      {plan.episodes
        .filter((c) => c.shot === index)
        .map((c, i) => (
          <Sequence key={i} from={f(c.start - shot.start)} durationInFrames={Math.max(1, f(c.dur))}>
            <PhoneEpisode cue={c} timeline={timelines[c.episodeId]} />
          </Sequence>
        ))}
      {plan.clicks
        .filter((c) => c.shot === index)
        .map((c, i) => (
          <Cursor key={i} cue={c} shotStart={shot.start} />
        ))}
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 40, top: 36, display: "flex", alignItems: "center", gap: 14, padding: "12px 26px 12px 18px", background: INK, color: PAPER, fontFamily: gothic, fontWeight: 700, fontSize: 30, borderLeft: `10px solid ${SHU}`, opacity: enter, transform: `translateX(${(1 - enter) * -30}px)`, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
      {text}
    </div>
  );
};

const SpeedBadge: React.FC<{ speed: number }> = ({ speed }) => (
  <div style={{ position: "absolute", right: 40, top: 36, padding: "10px 22px", background: "rgba(31,28,23,.88)", color: "#fff", fontFamily: gothic, fontWeight: 700, fontSize: 30, borderRadius: 6 }}>
    ▶▶ 早送り ×{Math.round(speed)}
  </div>
);

/** Narration subtitles, one sentence at a time, timed by sentence length. */
const Caption: React.FC<{ cue: NarrationCue }> = ({ cue }) => {
  const frame = useCurrentFrame() / FPS;
  const sentences = cue.text.match(/[^。]+。?/g) ?? [cue.text];
  const total = sentences.reduce((s, x) => s + x.length, 0);
  let acc = 0;
  const current = sentences.find((s) => {
    acc += s.length;
    return frame < (acc / total) * cue.dur;
  }) ?? sentences.at(-1);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1500, padding: "14px 34px", background: "rgba(20,18,15,.84)", color: "#fff", fontFamily: gothic, fontWeight: 700, fontSize: 40, lineHeight: 1.45, textAlign: "center", borderRadius: 8 }}>{current}</div>
    </div>
  );
};

const Hook: React.FC<{ plan: Plan; timeline: Timeline }> = ({ plan, timeline }) => {
  const frame = useCurrentFrame();
  const h = 960;
  const w = (h * 9) / 16;
  const caption = interpolate(frame, [f(plan.hook.dur - 3.4), f(plan.hook.dur - 3)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: w + 24, height: h + 24, borderRadius: 34, background: INK, boxShadow: "0 30px 60px -30px rgba(40,25,5,.7)" }}>
        <div style={{ position: "absolute", left: 12, top: 12, width: w, height: h, overflow: "hidden", borderRadius: 22 }}>
          <div style={{ width: 1080, height: 1920, transform: `scale(${w / 1080})`, transformOrigin: "0 0" }}>
            <Episode episodeId={plan.hook.episodeId} timeline={timeline} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", right: 120, top: 380, width: 520, opacity: caption, fontFamily: mincho, fontWeight: 700, fontSize: 54, lineHeight: 1.5, color: INK }}>
        この動画は、
        <br />
        AIが役場の資料から
        <br />
        作りました。
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: PAPER, alignItems: "center", justifyContent: "center", color: INK, opacity: enter }}>
      <div style={{ fontFamily: mincho, fontWeight: 700, fontSize: 120, letterSpacing: "0.08em", borderBottom: `10px double ${INK}`, paddingBottom: 16 }}>まちのAI放送局</div>
      <div style={{ marginTop: 34, fontFamily: mincho, fontWeight: 700, fontSize: 52 }}>町の決定を、町のみんなに。</div>
      <div style={{ marginTop: 60, fontFamily: gothic, fontSize: 32, color: "#6b6457" }}>github.com/b84330808/machi-ai-hoso　｜　Built with Claude: Japan 2026</div>
    </AbsoluteFill>
  );
};

/** Consecutive shots with the same chip share one chip, so it stays up across a newsroom step. */
const chipRuns = (shots: Shot[]) => {
  const runs: { text: string; start: number; dur: number }[] = [];
  for (const s of shots) {
    if (!s.chip) continue;
    const last = runs.at(-1);
    if (last && last.text === s.chip && Math.abs(last.start + last.dur - s.start) < 1e-6) last.dur += s.dur;
    else runs.push({ text: s.chip, start: s.start, dur: s.dur });
  }
  return runs;
};

export const Demo: React.FC<DemoProps> = ({ plan, timelines }) => {
  if (!plan) return null;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={f(plan.hook.dur)}>
        <Hook plan={plan} timeline={timelines[plan.hook.episodeId]} />
      </Sequence>
      {plan.shots.map((shot, i) => (
        <Sequence key={i} from={f(shot.start)} durationInFrames={Math.max(1, f(shot.start + shot.dur) - f(shot.start))}>
          <ShotView shot={shot} prevZoom={plan.shots[i - 1]?.zoom ?? 1} plan={plan} index={i} timelines={timelines} />
          {!shot.hold && shot.speed > 1.3 && <SpeedBadge speed={shot.speed} />}
        </Sequence>
      ))}
      {chipRuns(plan.shots).map((run, i) => (
        <Sequence key={`chip${i}`} from={f(run.start)} durationInFrames={f(run.dur)}>
          <Chip text={run.text} />
        </Sequence>
      ))}
      <Sequence from={f(plan.outro.start)} durationInFrames={f(plan.outro.dur)}>
        <Outro />
      </Sequence>
      {plan.narration.map((n) => (
        <Sequence key={n.id} from={f(n.start)} durationInFrames={f(n.dur) + 6}>
          <Audio src={staticFile(n.file)} />
          {n.id !== "outro" && <Caption cue={n} />}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
