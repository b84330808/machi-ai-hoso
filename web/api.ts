import type { CityConfig } from "../scripts/city";
import type { Audience, Fact, JobEvent, Story } from "../scripts/events";
import type { Episode } from "../src/schema";

export type EpisodeSummary = {
  id: string;
  cityId: string | null;
  date: string | null;
  audience: Audience | null;
  title: string;
  voiced: boolean;
  mp4: boolean;
  /** A recorded newsroom run exists, which the playback build can replay. */
  hasLog: boolean;
};

export type AppState = { hasApiKey: boolean; cities: CityConfig[]; episodes: EpisodeSummary[] };
export type RunLog = { episodeId: string; events: { at: number; event: JobEvent }[] };

/**
 * The public playback build (npm run build:static) has no server: it reads pre-built JSON next to the page and
 * replays recorded newsroom runs instead of starting new ones.
 */
export const STATIC = import.meta.env.VITE_STATIC === "1";
const data = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;
export type EpisodeDetail = { episode: Episode; story: Story | null; facts: Fact[] };

const getJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
};

const post = <T,>(url: string, body: unknown) =>
  getJson<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  state: () => getJson<AppState>(STATIC ? data("state.json") : "/api/state"),
  episode: (id: string) => getJson<EpisodeDetail>(STATIC ? data(`episodes/${id}.json`) : `/api/episodes/${id}`),
  log: (id: string) => getJson<RunLog>(data(`logs/${id}.json`)),
  make: (cityId: string, audience: Audience, reuseFacts: boolean) => post<{ jobId: string }>("/api/make", { cityId, audience, reuseFacts }),
  voice: (episodeId: string) => post<{ jobId: string }>("/api/voice", { episodeId }),
  render: (episodeId: string) => post<{ jobId: string }>("/api/render", { episodeId }),
};

/** Streams a job's events (replaying earlier ones) until it finishes. */
export const followJob = (jobId: string, onEvent: (e: JobEvent) => void) => {
  const source = new EventSource(`/api/jobs/${jobId}`);
  source.onmessage = (msg) => {
    const event: JobEvent = JSON.parse(msg.data);
    onEvent(event);
    if (event.type === "done" || event.type === "error") source.close();
  };
  source.onerror = () => source.close();
  return () => source.close();
};

/** Longest pause kept when replaying a run; the real waits (a minute or more) are squeezed to this. */
const REPLAY_MAX_GAP = 1.6;

/**
 * Replays a recorded run with the same events, waiting at most REPLAY_MAX_GAP seconds between them, then shows
 * the narration step (not in the log: the app's server runs it after the newsroom) and finishes.
 */
export const replayRun = (log: RunLog, lineCount: number, onEvent: (e: JobEvent) => void) => {
  const timers: number[] = [];
  let at = 0;
  let prev = 0;
  const later = (seconds: number, e: JobEvent) => timers.push(window.setTimeout(() => onEvent(e), seconds * 1000));
  for (const { at: t, event } of log.events) {
    at += Math.min(t - prev, REPLAY_MAX_GAP);
    prev = t;
    later(at, event);
  }
  later((at += 0.3), { type: "step", step: "voice", state: "start" });
  for (let i = 1; i <= lineCount; i++) later((at += 0.12), { type: "voiced", lineId: `l${i}`, done: i, total: lineCount });
  later((at += 0.3), { type: "step", step: "voice", state: "done" });
  later((at += 0.2), { type: "done", episodeId: log.episodeId });
  return () => timers.forEach((t) => window.clearTimeout(t));
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  general: "一般",
  parents: "子育て世帯",
  seniors: "シニア",
  easy: "やさしい日本語",
};

/** "資料タイトル p.3" → link to that page of the original PDF. */
export const sourceLink = (city: CityConfig | undefined, ref: string | undefined) => {
  if (!city || !ref) return undefined;
  const m = ref.match(/^(.*) p\.(\d+)$/);
  const doc = m && city.docs.find((d) => d.title === m[1]);
  return doc ? { url: `${doc.url}#page=${m[2]}`, page: Number(m[2]), title: doc.title } : undefined;
};
