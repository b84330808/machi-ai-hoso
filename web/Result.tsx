import { Player, PlayerRef } from "@remotion/player";
import { useEffect, useRef, useState, type FC, type RefObject } from "react";
import type { CityConfig } from "../scripts/city";
import { Episode as EpisodeView } from "../src/Episode";
import { loadTimeline } from "../src/load";
import { FPS, Timeline } from "../src/timeline";
import { layout } from "../src/theme";
import { EpisodeDetail, sourceLink } from "./api";

export const useTimeline = (episodeId: string | null) => {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  useEffect(() => {
    setTimeline(null);
    if (!episodeId) return;
    let live = true;
    loadTimeline(episodeId).then((t) => live && setTimeline(t));
    return () => {
      live = false;
    };
  }, [episodeId]);
  return timeline;
};

export const Phone: FC<{ episodeId: string; timeline: Timeline; playerRef: RefObject<PlayerRef | null> }> = ({ episodeId, timeline, playerRef }) => (
  <Player
    ref={playerRef}
    component={EpisodeView}
    inputProps={{ episodeId, timeline }}
    durationInFrames={timeline.total}
    fps={FPS}
    compositionWidth={layout.width}
    compositionHeight={layout.height}
    style={{ width: "100%", height: "100%" }}
    controls
    autoPlay
    clickToPlay
    acknowledgeRemotionLicense
  />
);

const clock = (frame: number) => {
  const s = Math.floor(frame / FPS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const SPEAKER = { anchor: "マチコ", kid: "ソウタ" } as const;

/** The script line by line, following playback; each line links to the PDF page it came from. */
export const Transcript: FC<{ timeline: Timeline; detail: EpisodeDetail | null; city: CityConfig | undefined; playerRef: RefObject<PlayerRef | null> }> = ({
  timeline,
  detail,
  city,
  playerRef,
}) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [playerRef, timeline]);

  const facts = new Map((detail?.facts ?? []).map((f) => [f.id, f]));
  const current = [...timeline.lines].reverse().find((l) => frame >= l.globalStart)?.id;
  const activeRow = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRow.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [current]);

  return (
    <ol className="transcript">
      {timeline.lines.map((line) => {
        const link = sourceLink(city, line.sourceRef);
        const quote = line.factIds?.map((id) => facts.get(id)?.quote).find(Boolean);
        return (
          <li
            key={line.id}
            ref={line.id === current ? activeRow : undefined}
            className={`t-line speaker-${line.speaker} ${line.id === current ? "current" : ""}`}
            onClick={() => {
              playerRef.current?.seekTo(line.globalStart);
              playerRef.current?.play();
            }}
          >
            <span className="t-time">{clock(line.globalStart)}</span>
            <span className={`t-speaker speaker-${line.speaker}`}>{SPEAKER[line.speaker]}</span>
            <div className="t-body">
              <span className="t-text">{line.text}</span>
              {(link || quote) && (
                <div className="t-source">
                  {link && (
                    <a className="t-page" href={link.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={link.title}>
                      出典 p.{link.page}
                    </a>
                  )}
                  {quote && <span className="t-quote">原文「{quote}」</span>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
