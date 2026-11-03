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
};

export type AppState = { hasApiKey: boolean; cities: CityConfig[]; episodes: EpisodeSummary[] };
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
  state: () => getJson<AppState>("/api/state"),
  episode: (id: string) => getJson<EpisodeDetail>(`/api/episodes/${id}`),
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
